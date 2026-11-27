import { Pool } from 'pg';

import { loadEnvFiles } from './lib/load-env';

loadEnvFiles();

function normalize(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return rawUrl;
  }
}

const rawUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '';

if (!rawUrl) {
  console.error('✖ ไม่พบ DATABASE_URL / DATABASE_URL_UNPOOLED');
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: normalize(rawUrl), max: 1 });

  try {
    const result = await pool.query<{
      database: string;
      username: string;
      version: string;
    }>(
      'select current_database() as database, current_user as username, version() as version',
    );

    const row = result.rows[0];
    console.log('✔ เชื่อมต่อฐานข้อมูลสำเร็จ');
    console.log(`  database: ${row?.database}`);
    console.log(`  user: ${row?.username}`);
    console.log(`  version: ${row?.version?.split(' ').slice(0, 2).join(' ')}`);

    const tables = await pool.query<{ count: string }>(
      `select count(*)::text as count
       from information_schema.tables
       where table_schema = 'public'
         and table_name in ('users','categories','products','stock_movements','sessions','login_attempts')`,
    );
    console.log(`  core tables: ${tables.rows[0]?.count ?? '0'} / 6`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : 'unknown';
    console.error(`✖ เชื่อมต่อฐานข้อมูลไม่สำเร็จ (code: ${code})`);
    console.error(`  ${message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
