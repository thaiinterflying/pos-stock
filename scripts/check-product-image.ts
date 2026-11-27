/**
 * ตรวจฟีเจอร์รูปสินค้าแบบ end-to-end กับ production build:
 * 1. สร้าง session ของ Admin/Staff ใน DB โดยตรง
 * 2. POST ฟอร์มเพิ่มสินค้าพร้อมไฟล์ PNG ผ่าน Server Action จริง
 * 3. ตรวจ DB ว่ามี image_key และ Object Storage มีไฟล์จริง
 * 4. GET /api/products/[id]/image ด้วย Admin/Staff = 200 และได้ไบต์ตรงกัน
 * 5. GET โดยไม่ login ต้องถูกบล็อก
 * 6. ลบข้อมูลทดสอบทั้งหมด (สินค้า, ไฟล์, session)
 *
 * ต้องมี DATABASE_URL และ AWS_* ใน .env.local
 */

import { spawn, spawnSync } from 'node:child_process';

import { and, eq, inArray, sql } from 'drizzle-orm';

import { generateSessionToken, hashSessionToken } from '../server/auth/tokens';
import { closeDb, getDb } from '../server/db';
import { categories, products, sessions, stockMovements, users } from '../server/db/schema';
import { deleteObjectQuietly, getObjectBytes } from '../server/lib/object-storage';
import { loadEnvFiles } from './lib/load-env';

const PORT = Number(process.env.IMAGE_CHECK_PORT ?? 4313);
const BASE = `http://127.0.0.1:${PORT}`;

// PNG 1x1 (โปร่งใส) — ใช้เทียบไบต์แบบตรงตัว
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_BYTES = Uint8Array.from(Buffer.from(PNG_BASE64, 'base64'));

const server = spawn('npm', ['run', 'start', '--', '-p', String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
  env: process.env,
});

let serverOutput = '';
server.stdout?.on('data', (chunk: Buffer) => {
  serverOutput += chunk.toString();
});
server.stderr?.on('data', (chunk: Buffer) => {
  serverOutput += chunk.toString();
});

function stopServer(): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
}

async function waitForServer(timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) return;
    } catch {
      // server ยังไม่พร้อม
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error('server ไม่พร้อมภายในเวลาที่กำหนด');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** ดึง hidden inputs ของ Server Action (React 19: $ACTION_REF_1 / $ACTION_1:0 / $ACTION_KEY) */
function extractActionFields(html: string): Array<{ name: string; value: string }> {
  const fields: Array<{ name: string; value: string }> = [];

  for (const match of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = match[0];
    if (!tag.includes('$ACTION')) continue;

    const nameMatch = tag.match(/name="([^"]*)"/);
    if (!nameMatch?.[1]) continue;

    const valueMatch = tag.match(/value="([^"]*)"/);
    fields.push({
      name: decodeHtmlEntities(nameMatch[1]),
      value: valueMatch ? decodeHtmlEntities(valueMatch[1]) : '',
    });
  }

  return fields;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`✔ ${message}`);
}

async function getPageHtml(cookie: string, path: string): Promise<string> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });

  if (response.status !== 200) {
    throw new Error(`GET ${path} = ${response.status}`);
  }

  return response.text();
}

async function submitProductAction(
  path: string,
  cookie: string,
  actionFields: Array<{ name: string; value: string }>,
  fields: Record<string, string>,
  file?: File,
): Promise<Response> {
  const form = new FormData();
  for (const field of actionFields) {
    form.set(field.name, field.value);
  }
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  if (file) {
    form.set('image', file);
  }

  return fetch(`${BASE}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Origin: BASE,
      Referer: `${BASE}${path}`,
      Cookie: cookie,
    },
    body: form,
  });
}

async function createSessionCookie(userId: string): Promise<{ cookie: string; tokenHash: string }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  await getDb().insert(sessions).values({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ip: '127.0.0.1',
    userAgent: 'tif-stock-image-check',
  });

  return { cookie: `tif_session=${token}`, tokenHash };
}

async function main(): Promise<void> {
  loadEnvFiles();

  if (!process.env.DATABASE_URL) {
    throw new Error('ไม่พบ DATABASE_URL');
  }
  if (!process.env.AWS_ENDPOINT_URL_S3) {
    throw new Error('ไม่พบ AWS_ENDPOINT_URL_S3 (Object Storage ยังไม่พร้อม)');
  }

  const db = getDb();
  const sku = `IMG-CHECK-${Date.now().toString(36).toUpperCase()}`;
  let productId: string | null = null;
  let imageKey: string | null = null;
  const tokenHashes: string[] = [];
  const uploadedKeys: string[] = [];

  console.log('▶ รอแอปเริ่มทำงาน...');
  await waitForServer();

  try {
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true)))
      .limit(1);
    if (!admin) throw new Error('ไม่พบผู้ใช้ Admin ที่ใช้งานอยู่');

    const [staff] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'STAFF'), eq(users.isActive, true)))
      .limit(1);

    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.isActive, true))
      .limit(1);
    if (!category) throw new Error('ไม่พบหมวดหมู่ที่ใช้งานอยู่');

    const adminSession = await createSessionCookie(admin.id);
    tokenHashes.push(adminSession.tokenHash);

    const staffSession = staff ? await createSessionCookie(staff.id) : null;
    if (staffSession) tokenHashes.push(staffSession.tokenHash);

    // 1) โหลดฟอร์มเพิ่มสินค้าเพื่อเอา Server Action fields
    const formPage = await fetch(`${BASE}/products/new`, {
      headers: { Cookie: adminSession.cookie },
      redirect: 'manual',
    });
    assert(formPage.status === 200, 'GET /products/new = 200');

    const actionFields = extractActionFields(await formPage.text());
    assert(actionFields.length > 0, 'พบ hidden fields ของ Server Action');

    // 2) POST ฟอร์มพร้อมไฟล์รูป
    const form = new FormData();
    for (const field of actionFields) {
      form.set(field.name, field.value);
    }
    form.set('sku', sku);
    form.set('name', 'สินค้าทดสอบรูปภาพ (ลบอัตโนมัติ)');
    form.set('categoryId', category.id);
    form.set('unit', 'ชิ้น');
    form.set('minStock', '0');
    form.set('openingStock', '0');
    form.set('storageLocation', '');
    form.set('description', 'ทดสอบอัปโหลดรูป');
    form.set('image', new File([PNG_BYTES], 'test.png', { type: 'image/png' }));

    const createResponse = await fetch(`${BASE}/products/new`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Origin: BASE,
        Referer: `${BASE}/products/new`,
        Cookie: adminSession.cookie,
      },
      body: form,
    });

    const location = createResponse.headers.get('location') ?? '';
    if (!location.includes('/products/')) {
      const html = await createResponse.text();
      throw new Error(
        `สร้างสินค้าไม่สำเร็จ (status ${createResponse.status}): ${html
          .slice(0, 300)
          .replace(/\s+/g, ' ')}`,
      );
    }

    const idMatch = location.match(/\/products\/([0-9a-f-]{36})/i);
    assert(Boolean(idMatch), 'สร้างสินค้าพร้อมรูปสำเร็จ (redirect ไปหน้ารายละเอียด)');
    productId = idMatch![1] ?? null;
    if (!productId) throw new Error('ไม่พบรหัสสินค้าจาก redirect');

    // 3) ตรวจ DB + Object Storage
    const [row] = await db
      .select({ id: products.id, imageKey: products.imageKey, imageUpdatedAt: products.imageUpdatedAt })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!row?.imageKey) throw new Error('ไม่พบ image_key ในฐานข้อมูล');
    imageKey = row.imageKey;
    uploadedKeys.push(imageKey);
    assert(Boolean(row.imageUpdatedAt), 'บันทึก image_key + image_updated_at ลง DB');

    const stored = await getObjectBytes(row.imageKey);
    if (!stored) throw new Error('ไม่พบไฟล์ใน Object Storage');
    assert(
      stored.contentType === 'image/png' && bytesEqual(stored.bytes, PNG_BYTES),
      'Object Storage เก็บไฟล์ตรงกับที่อัปโหลด',
    );

    // 4) เสิร์ฟรูปด้วย Admin และ Staff
    const imageUrl = `${BASE}/api/products/${productId}/image`;
    const adminImage = await fetch(imageUrl, {
      headers: { Cookie: adminSession.cookie },
    });
    const adminBytes = new Uint8Array(await adminImage.arrayBuffer());
    assert(
      adminImage.status === 200 &&
        adminImage.headers.get('content-type') === 'image/png' &&
        bytesEqual(adminBytes, PNG_BYTES),
      'Admin GET รูปสินค้า = 200 + ไบต์ตรง',
    );

    if (staffSession) {
      const staffImage = await fetch(imageUrl, {
        headers: { Cookie: staffSession.cookie },
      });
      assert(staffImage.status === 200, 'Staff GET รูปสินค้า = 200');
    }

    // 5) ไม่ login ต้องถูกบล็อก (middleware redirect หรือ 401)
    const anonymous = await fetch(imageUrl, { redirect: 'manual' });
    assert(
      anonymous.status === 401 ||
        (anonymous.status >= 300 && anonymous.status < 400),
      `ไม่ login เข้าถึงรูปไม่ได้ (status ${anonymous.status})`,
    );

    // 6) แก้ไขสินค้า: เปลี่ยนรูป
    const editPath = `/products/${productId}/edit`;
    const baseFields: Record<string, string> = {
      productId,
      sku,
      name: 'สินค้าทดสอบรูปภาพ (ลบอัตโนมัติ)',
      categoryId: category.id,
      unit: 'ชิ้น',
      minStock: '0',
      storageLocation: '',
      description: 'ทดสอบอัปโหลดรูป',
    };
    const replacementBytes = new Uint8Array([...PNG_BYTES, 0x00]);

    const editFields = extractActionFields(await getPageHtml(adminSession.cookie, editPath));
    const replaceResponse = await submitProductAction(
      editPath,
      adminSession.cookie,
      editFields,
      baseFields,
      new File([replacementBytes], 'replace.png', { type: 'image/png' }),
    );
    assert(
      (replaceResponse.headers.get('location') ?? '').includes('updated=1'),
      'เปลี่ยนรูปสินค้าผ่านฟอร์มแก้ไขสำเร็จ',
    );

    const [afterReplace] = await db
      .select({ imageKey: products.imageKey })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!afterReplace?.imageKey || afterReplace.imageKey === imageKey) {
      throw new Error('image_key ไม่เปลี่ยนหลังอัปโหลดรูปใหม่');
    }
    imageKey = afterReplace.imageKey;
    uploadedKeys.push(imageKey);
    console.log('✔ image_key เปลี่ยนเป็นไฟล์ใหม่');

    assert(
      (await getObjectBytes(uploadedKeys[0]!)) === null,
      'ไฟล์รูปเดิมถูกลบออกจาก Object Storage',
    );

    const replacedImage = await fetch(imageUrl, {
      headers: { Cookie: adminSession.cookie },
    });
    const replacedBytes = new Uint8Array(await replacedImage.arrayBuffer());
    assert(
      replacedImage.status === 200 && bytesEqual(replacedBytes, replacementBytes),
      'GET รูปหลังเปลี่ยนได้ไบต์ใหม่',
    );

    // 7) แก้ไขสินค้า: ลบรูป
    const removeFields = extractActionFields(await getPageHtml(adminSession.cookie, editPath));
    const removeResponse = await submitProductAction(editPath, adminSession.cookie, removeFields, {
      ...baseFields,
      removeImage: '1',
    });
    assert(
      (removeResponse.headers.get('location') ?? '').includes('updated=1'),
      'ลบรูปสินค้าผ่านฟอร์มแก้ไขสำเร็จ',
    );

    const [afterRemove] = await db
      .select({ imageKey: products.imageKey })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    assert(afterRemove?.imageKey === null, 'DB เคลียร์ image_key หลังลบรูป');

    const removedImage = await fetch(imageUrl, {
      headers: { Cookie: adminSession.cookie },
      redirect: 'manual',
    });
    assert(removedImage.status === 404, 'GET รูปหลังลบ = 404');

    // 8) ปรับจำนวนคงเหลือจากฟอร์มแก้ไข (ต้องมีเหตุผล + เก็บประวัติ)
    const adjustFields = extractActionFields(await getPageHtml(adminSession.cookie, editPath));
    const adjustResponse = await submitProductAction(editPath, adminSession.cookie, adjustFields, {
      ...baseFields,
      countedQuantity: '4',
      reason: 'ตรวจนับประจำเดือน (ทดสอบ)',
      adjustmentRequestId: crypto.randomUUID(),
    });
    const adjustLocation = adjustResponse.headers.get('location') ?? '';
    assert(
      adjustLocation.includes('updated=1') && adjustLocation.includes('adjusted=1'),
      'บันทึกการแก้ไขพร้อมปรับจำนวนคงเหลือสำเร็จ',
    );

    const [afterAdjust] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    assert(afterAdjust?.currentStock === 4, 'current_stock = 4 หลังปรับยอด');

    const movements = await db
      .select({
        type: stockMovements.type,
        quantityChange: stockMovements.quantityChange,
        quantityBefore: stockMovements.quantityBefore,
        quantityAfter: stockMovements.quantityAfter,
        note: stockMovements.note,
      })
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId));

    assert(movements.length === 1, 'มี Stock Movement 1 รายการ (ADJUSTMENT)');
    assert(
      movements[0]?.type === 'ADJUSTMENT' &&
        movements[0]?.quantityChange === 4 &&
        movements[0]?.quantityBefore === 0 &&
        movements[0]?.quantityAfter === 4 &&
        movements[0]?.note === 'ตรวจนับประจำเดือน (ทดสอบ)',
      'movement บันทึก before/after/เหตุผลถูกต้อง',
    );

    // 9) ส่งจำนวนเดิมอีกครั้ง = ต้องไม่สร้าง movement ซ้ำ
    const sameFields = extractActionFields(await getPageHtml(adminSession.cookie, editPath));
    const sameResponse = await submitProductAction(editPath, adminSession.cookie, sameFields, {
      ...baseFields,
      countedQuantity: '4',
      reason: 'ตรวจนับซ้ำ (ทดสอบ)',
      adjustmentRequestId: crypto.randomUUID(),
    });
    const sameLocation = sameResponse.headers.get('location') ?? '';
    assert(
      sameLocation.includes('updated=1') && !sameLocation.includes('adjusted=1'),
      'ส่งจำนวนเท่าเดิมไม่เกิดการปรับยอดซ้ำ',
    );

    const [movementCount] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId));
    assert(movementCount?.total === 1, 'จำนวน movement ยังเป็น 1 รายการ (ไม่เพิ่ม)');

    console.log('\n✅ Product edit check (รูป + จำนวนคงเหลือ) ผ่านทั้งหมด');
  } finally {
    // 6) cleanup
    try {
      if (productId) {
        await db.delete(stockMovements).where(eq(stockMovements.productId, productId));
        await db.delete(products).where(eq(products.id, productId));
      }
      if (uploadedKeys.length > 0) {
        for (const key of new Set(uploadedKeys)) {
          await deleteObjectQuietly(key);
        }
      }
      if (tokenHashes.length > 0) {
        await db.delete(sessions).where(inArray(sessions.tokenHash, tokenHashes));
      }
    } catch (error) {
      console.error('⚠ cleanup ไม่สมบูรณ์:', error instanceof Error ? error.message : error);
    }
  }
}

main()
  .catch((error) => {
    console.error('\n✖ Product image check ล้มเหลว');
    console.error(error instanceof Error ? error.message : error);
    if (serverOutput) {
      console.error('\n--- server output (tail) ---');
      console.error(serverOutput.split(/\r?\n/).slice(-25).join('\n'));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    stopServer();
    await closeDb();
  });
