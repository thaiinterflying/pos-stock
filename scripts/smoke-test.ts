import { spawn, spawnSync } from 'node:child_process';

/**
 * Smoke test แบบ end-to-end กับ production build:
 * - start `npm run start`
 * - login ผ่าน Server Action (progressive enhancement form)
 * - ตรวจDashboard/Products, สิทธิ์ Staff, /api/health (Postgres + Object Storage)
 * - ดาวน์โหลด CSV export และตรวจ UTF-8 BOM
 *
 * ต้องกำหนด:
 *   SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD
 *   SMOKE_STAFF_EMAIL, SMOKE_STAFF_PASSWORD (ไม่บังคับ)
 *   SMOKE_PORT (ค่าเริ่มต้น 4311)
 */

const PORT = Number(process.env.SMOKE_PORT ?? 4311);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD;
const STAFF_EMAIL = process.env.SMOKE_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.SMOKE_STAFF_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('✖ ต้องกำหนด SMOKE_ADMIN_EMAIL และ SMOKE_ADMIN_PASSWORD');
  process.exit(1);
}

type CookieJar = Map<string, string>;

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

function storeCookies(response: Response, jar: CookieJar): void {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie')].filter((value): value is string => Boolean(value));

  for (const setCookie of setCookies) {
    const firstPart = setCookie.split(';')[0] ?? '';
    const separator = firstPart.indexOf('=');
    if (separator > 0) {
      jar.set(firstPart.slice(0, separator), firstPart.slice(separator + 1));
    }
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

async function waitForServer(timeoutMs = 45_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (response.ok || response.status === 503) return body;
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

async function login(email: string, password: string): Promise<CookieJar> {
  const jar: CookieJar = new Map();

  const loginPage = await fetch(`${BASE}/login`, { redirect: 'manual' });
  storeCookies(loginPage, jar);
  const html = await loginPage.text();

  // React 19 progressive enhancement: form ส่ง $ACTION_REF_1 / $ACTION_1:0 / $ACTION_KEY
  const hiddenActionInputs: Array<{ name: string; value: string }> = [];
  for (const match of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = match[0];
    if (!tag.includes('$ACTION')) continue;

    const nameMatch = tag.match(/name="([^"]*)"/);
    if (!nameMatch?.[1]) continue;

    const valueMatch = tag.match(/value="([^"]*)"/);
    hiddenActionInputs.push({
      name: decodeHtmlEntities(nameMatch[1]),
      value: valueMatch ? decodeHtmlEntities(valueMatch[1]) : '',
    });
  }

  if (hiddenActionInputs.length === 0) {
    throw new Error('ไม่พบ hidden fields ของ Server Action ในฟอร์ม login');
  }

  const form = new FormData();
  for (const input of hiddenActionInputs) {
    form.set(input.name, input.value);
  }
  form.set('email', email);
  form.set('password', password);
  form.set('next', '/dashboard');

  const response = await fetch(`${BASE}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Origin: BASE,
      Referer: `${BASE}/login`,
      Cookie: cookieHeader(jar),
    },
    body: form,
  });

  storeCookies(response, jar);

  if (!jar.get('tif_session')) {
    const text = await response.text();
    throw new Error(
      `login ไม่สำเร็จ (status ${response.status}): ${text.slice(0, 300).replace(/\s+/g, ' ')}`,
    );
  }

  return jar;
}

async function getPage(jar: CookieJar, path: string): Promise<{ status: number; html: string; location: string | null }> {
  const response = await fetch(`${BASE}${path}`, {
    redirect: 'manual',
    headers: { Cookie: cookieHeader(jar) },
  });

  return {
    status: response.status,
    html: await response.text(),
    location: response.headers.get('location'),
  };
}

async function main(): Promise<void> {
  console.log('▶ รอแอปเริ่มทำงาน...');
  const initialHealth = await waitForServer();
  console.log(`  health: ${JSON.stringify(initialHealth)}`);

  const assert = (condition: unknown, message: string): void => {
    if (!condition) throw new Error(message);
    console.log(`✔ ${message}`);
  };

  const adminJar = await login(ADMIN_EMAIL!, ADMIN_PASSWORD!);
  console.log('✔ Admin login สำเร็จ (session cookie ถูกตั้งค่า)');

  const dashboard = await getPage(adminJar, '/dashboard');
  assert(dashboard.status === 200 && dashboard.html.includes('แดชบอร์ด'), 'GET /dashboard = 200');

  const products = await getPage(adminJar, '/products');
  assert(products.status === 200 && products.html.includes('สินค้า'), 'GET /products = 200');

  const healthResponse = await fetch(`${BASE}/api/health`);
  const health = (await healthResponse.json()) as {
    status?: string;
    database?: string;
    storage?: string;
  };
  assert(
    healthResponse.status === 200 &&
      health.database === 'up' &&
      health.storage === 'up' &&
      health.status === 'ok',
    '/api/health: Postgres + Object Storage = up',
  );

  const exportResponse = await fetch(`${BASE}/api/export/stock-movements`, {
    headers: { Cookie: cookieHeader(adminJar) },
  });
  const exportBytes = new Uint8Array(await exportResponse.arrayBuffer());
  const exportText = new TextDecoder('utf-8').decode(exportBytes);
  const hasBom =
    exportBytes[0] === 0xef && exportBytes[1] === 0xbb && exportBytes[2] === 0xbf;

  console.log(
    `  export: status=${exportResponse.status} type=${exportResponse.headers.get('content-type')} bytes=${exportBytes.length}`,
  );

  assert(
    exportResponse.status === 200 &&
      exportResponse.headers.get('content-type')?.includes('text/csv') === true &&
      hasBom &&
      exportText.includes('วันที่ (เวลาไทย)'),
    'CSV export (Admin): UTF-8 BOM + header ถูกต้อง',
  );

  const xlsxResponse = await fetch(`${BASE}/api/export/stock-movements?format=xlsx`, {
    headers: { Cookie: cookieHeader(adminJar) },
  });
  const xlsxBytes = new Uint8Array(await xlsxResponse.arrayBuffer());
  const isZip = xlsxBytes[0] === 0x50 && xlsxBytes[1] === 0x4b;

  console.log(
    `  xlsx: status=${xlsxResponse.status} type=${xlsxResponse.headers.get('content-type')} bytes=${xlsxBytes.length}`,
  );

  assert(
    xlsxResponse.status === 200 &&
      xlsxResponse.headers.get('content-type')?.includes('spreadsheetml.sheet') === true &&
      isZip &&
      xlsxBytes.length > 1_000,
    'Excel export (Admin): .xlsx ถูกต้อง (ZIP signature)',
  );

  if (STAFF_EMAIL && STAFF_PASSWORD) {
    const staffJar = await login(STAFF_EMAIL, STAFF_PASSWORD);
    console.log('✔ Staff login สำเร็จ');

    const staffExport = await fetch(`${BASE}/api/export/stock-movements`, {
      headers: { Cookie: cookieHeader(staffJar) },
    });
    assert(staffExport.status === 403, 'Staff เรียก CSV export ได้ 403');

    const staffXlsx = await fetch(`${BASE}/api/export/stock-movements?format=xlsx`, {
      headers: { Cookie: cookieHeader(staffJar) },
    });
    assert(staffXlsx.status === 403, 'Staff เรียก Excel export ได้ 403');

    const staffSettings = await getPage(staffJar, '/settings/users');

    const staffBlocked =
      (staffSettings.status >= 300 &&
        staffSettings.status < 400 &&
        Boolean(staffSettings.location?.includes('/dashboard'))) ||
      (staffSettings.status === 200 &&
        staffSettings.html.includes('แดชบอร์ด') &&
        !staffSettings.html.includes('จัดการผู้ใช้งาน') &&
        !staffSettings.html.includes('admin@tif.local'));

    assert(staffBlocked, 'Staff เข้า /settings/users ไม่เห็นหน้าตั้งค่า (ถูกพาไป Dashboard)');
  }

  console.log('\n✅ Smoke test ผ่านทั้งหมด');
}

main()
  .catch((error) => {
    console.error('\n✖ Smoke test ล้มเหลว');
    console.error(error instanceof Error ? error.message : error);
    if (serverOutput) {
      console.error('\n--- server output (tail) ---');
      console.error(serverOutput.split(/\r?\n/).slice(-25).join('\n'));
    }
    process.exitCode = 1;
  })
  .finally(stopServer);
