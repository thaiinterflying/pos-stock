import { randomUUID } from 'node:crypto';

import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '../../server/db';
import { categories, products, stockMovements, users } from '../../server/db/schema';
import { adjustToCountedQuantity, applyMovement } from '../../server/lib/stock-service';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

// ต้องกำหนดก่อนเรียก getDb() ครั้งแรก (getDb อ่าน env ตอนเรียก ไม่ใช่ตอน import)
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

type Database = ReturnType<typeof getDb>;

/**
 * Integration tests ต้องใช้ Neon branch ที่ migrate แล้ว (ห้ามชี้ production)
 * รันด้วย: TEST_DATABASE_URL="postgresql://..." bun run test:integration
 *
 * ถ้าไม่ได้ตั้ง TEST_DATABASE_URL ทั้งชุดจะถูก skip โดยไม่ทำให้ `bun run test` ล้มเหลว
 */
describe.skipIf(!TEST_DATABASE_URL)('stock movement integration (Neon branch)', () => {
  let db: Database | undefined;
  let userId = '';
  let categoryId = '';
  const productIds: string[] = [];

  let productForConcurrency = '';
  let productForIdempotency = '';
  let productForAdjustment = '';

  async function createProduct(sku: string, currentStock: number): Promise<string> {
    const [row] = await db!
      .insert(products)
      .values({
        sku,
        name: `Integration ${sku}`,
        categoryId,
        unit: 'ชิ้น',
        currentStock,
        minStock: 0,
      })
      .returning({ id: products.id });

    if (!row) throw new Error('ไม่สามารถสร้างสินค้าสำหรับทดสอบได้');
    productIds.push(row.id);
    return row.id;
  }

  async function stockOf(productId: string): Promise<number> {
    const [row] = await db!
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    return row?.currentStock ?? -1;
  }

  async function movementCount(productId: string): Promise<number> {
    const [row] = await db!
      .select({ count: sql<number>`count(*)::int` })
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId));

    return row?.count ?? 0;
  }

  beforeAll(async () => {
    db = getDb();
    const suffix = randomUUID().slice(0, 8).toUpperCase();

    const [user] = await db
      .insert(users)
      .values({
        name: 'Integration Test',
        email: `integration-${suffix.toLowerCase()}@tif.local`,
        passwordHash: 'not-a-real-hash',
        role: 'STAFF',
      })
      .returning({ id: users.id });

    if (!user) throw new Error('ไม่สามารถสร้างผู้ใช้สำหรับทดสอบได้');
    userId = user.id;

    const [category] = await db
      .insert(categories)
      .values({ name: `Integration ${suffix}` })
      .returning({ id: categories.id });

    if (!category) throw new Error('ไม่สามารถสร้างหมวดหมู่สำหรับทดสอบได้');
    categoryId = category.id;

    productForConcurrency = await createProduct(`IT-CON-${suffix}`, 5);
    productForIdempotency = await createProduct(`IT-IDEM-${suffix}`, 0);
    productForAdjustment = await createProduct(`IT-ADJ-${suffix}`, 10);
  }, 60_000);

  afterAll(async () => {
    if (!db) return;

    try {
      if (productIds.length > 0) {
        await db
          .delete(stockMovements)
          .where(inArray(stockMovements.productId, productIds));
        await db.delete(products).where(inArray(products.id, productIds));
      }

      if (categoryId) {
        await db.delete(categories).where(eq(categories.id, categoryId));
      }

      if (userId) {
        await db.delete(users).where(eq(users.id, userId));
      }
    } catch {
      // best-effort cleanup: ไม่ให้ข้อมูลทดสอบค้างแล้วกลบผลลัพธ์ test
    } finally {
      await closeDb();
    }
  }, 60_000);

  it('เบิกพร้อมกันจาก 5 ชิ้น: สำเร็จรายการเดียวและสต๊อกไม่ติดลบ', async () => {
    const results = await Promise.allSettled([
      db!.transaction((tx) =>
        applyMovement(tx, {
          productId: productForConcurrency,
          type: 'OUT',
          quantityChange: -4,
          recipientName: 'Integration Test',
          performedBy: userId,
          requestId: randomUUID(),
        }),
      ),
      db!.transaction((tx) =>
        applyMovement(tx, {
          productId: productForConcurrency,
          type: 'OUT',
          quantityChange: -4,
          recipientName: 'Integration Test',
          performedBy: userId,
          requestId: randomUUID(),
        }),
      ),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await stockOf(productForConcurrency)).toBe(1);
    expect(await movementCount(productForConcurrency)).toBe(1);
  }, 60_000);

  it('รับเข้าด้วย request_id เดิม: บันทึกครั้งเดียวและไม่เพิ่มสต๊อกซ้ำ', async () => {
    const input = {
      productId: productForIdempotency,
      type: 'IN' as const,
      quantityChange: 5,
      performedBy: userId,
      requestId: randomUUID(),
    };

    await db!.transaction((tx) => applyMovement(tx, input));
    await expect(db!.transaction((tx) => applyMovement(tx, input))).rejects.toThrow();

    expect(await stockOf(productForIdempotency)).toBe(5);
    expect(await movementCount(productForIdempotency)).toBe(1);
  }, 60_000);

  it('ปรับยอดตามจำนวนที่นับได้ และ replay ไม่สร้างรายการซ้ำ', async () => {
    const input = {
      productId: productForAdjustment,
      countedQuantity: 7,
      reason: 'ตรวจนับสำหรับ integration test',
      performedBy: userId,
      requestId: randomUUID(),
    };

    const first = await db!.transaction((tx) => adjustToCountedQuantity(tx, input));
    expect(first.changed).toBe(true);
    expect(first.replayed).toBe(false);
    expect(first.quantityBefore).toBe(10);
    expect(first.quantityAfter).toBe(7);

    const replay = await db!.transaction((tx) => adjustToCountedQuantity(tx, input));
    expect(replay.replayed).toBe(true);
    expect(replay.quantityAfter).toBe(7);

    const noChange = await db!.transaction((tx) =>
      adjustToCountedQuantity(tx, {
        ...input,
        requestId: randomUUID(),
        countedQuantity: 7,
      }),
    );
    expect(noChange.changed).toBe(false);

    expect(await stockOf(productForAdjustment)).toBe(7);
    expect(await movementCount(productForAdjustment)).toBe(1);
  }, 60_000);
});
