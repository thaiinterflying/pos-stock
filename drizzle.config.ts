import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit ใช้ connection แบบ direct (unpooled) สำหรับ migration
 * และใช้ node-postgres (pg) แทน serverless driver เพื่อให้รัน DDL ผ่าน TCP ได้
 */
function normalizedUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    // pg ไม่รองรับ channel binding — ตัดออกเพื่อไม่ให้ parse ล้มเหลว
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: normalizedUrl(
      process.env.DATABASE_URL_UNPOOLED ??
        process.env.DATABASE_URL ??
        'postgresql://placeholder:placeholder@localhost:5432/tif_stock',
    ),
  },
});
