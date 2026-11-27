import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { loadEnvFiles } from './lib/load-env';

loadEnvFiles();

const rawUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '';

function normalize(raw: string): string {
  try {
    const url = new URL(raw);
    // pg ไม่รองรับ channel binding; ตัดออกเพื่อหลีกเลี่ยง parse error
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

if (!rawUrl) {
  console.error('✖ ไม่พบ DATABASE_URL_UNPOOLED หรือ DATABASE_URL');
  process.exitCode = 1;
} else {
  const pool = new Pool({
    connectionString: normalize(rawUrl),
    max: 1,
    connectionTimeoutMillis: 20_000,
  });

  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✔ Migration applied successfully');
  } catch (error) {
    console.error('✖ Migration failed');
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
