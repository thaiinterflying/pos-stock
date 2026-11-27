import { loadEnvFiles } from './lib/load-env';

type CheckStatus = 'ok' | 'warn' | 'error';

type Check = {
  label: string;
  status: CheckStatus;
  message: string;
};

const SYMBOLS: Record<CheckStatus, string> = {
  ok: '✔',
  warn: '!',
  error: '✖',
};

function checkEnvironment(): Check[] {
  const checks: Check[] = [];
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const unpooledUrl = process.env.DATABASE_URL_UNPOOLED ?? '';
  const authSecret = process.env.AUTH_SECRET ?? '';

  if (!databaseUrl) {
    checks.push({
      label: 'DATABASE_URL',
      status: 'error',
      message: 'ยังไม่ได้กำหนด connection string ของ Neon',
    });
  } else {
    checks.push({
      label: 'DATABASE_URL',
      status: 'ok',
      message: 'พบ connection string',
    });

    if (!databaseUrl.includes('-pooler')) {
      checks.push({
        label: 'DATABASE_URL (pooler)',
        status: 'warn',
        message: 'ไม่พบ "-pooler" ใน host — บน serverless ควรใช้ pooled endpoint',
      });
    }

    if (!databaseUrl.includes('sslmode=require')) {
      checks.push({
        label: 'DATABASE_URL (ssl)',
        status: 'warn',
        message: 'แนะนำให้ต่อท้ายด้วย ?sslmode=require',
      });
    }
  }

  if (!unpooledUrl) {
    checks.push({
      label: 'DATABASE_URL_UNPOOLED',
      status: 'warn',
      message: 'ไม่ได้กำหนด — drizzle-kit migrate จะใช้ DATABASE_URL (อาจมีปัญหาเมื่อผ่าน pooler)',
    });
  } else {
    checks.push({
      label: 'DATABASE_URL_UNPOOLED',
      status: 'ok',
      message: 'พบ direct connection สำหรับ migration',
    });
  }

  if (!authSecret) {
    checks.push({
      label: 'AUTH_SECRET',
      status: 'error',
      message: 'ยังไม่ได้กำหนด (ใช้เป็น pepper สำหรับ login_attempts)',
    });
  } else if (authSecret.length < 32) {
    checks.push({
      label: 'AUTH_SECRET',
      status: 'warn',
      message: 'สั้นกว่า 32 ตัวอักษร — แนะนำให้สุ่มด้วย openssl rand -base64 32',
    });
  } else {
    checks.push({ label: 'AUTH_SECRET', status: 'ok', message: 'ความยาวเพียงพอ' });
  }

  if (process.env.NODE_ENV === 'production' && process.env.SEED_ADMIN_PASSWORD) {
    checks.push({
      label: 'SEED_ADMIN_PASSWORD',
      status: 'warn',
      message: 'ไม่ควรตั้งรหัสผ่าน seed ไว้ใน environment ของ production',
    });
  }

  return checks;
}

loadEnvFiles();

const checks = checkEnvironment();
let hasError = false;

console.log('\nTIF Stock — Environment Check\n');

for (const check of checks) {
  if (check.status === 'error') hasError = true;
  console.log(`${SYMBOLS[check.status]} ${check.label}: ${check.message}`);
}

console.log('');

if (hasError) {
  console.error('พบข้อผิดพลาดใน environment — กรุณาแก้ไขก่อน deploy\n');
  process.exitCode = 1;
} else {
  console.log('Environment พร้อมใช้งาน\n');
}
