import { sql } from 'drizzle-orm';

import { getDb } from '@/server/db';
import { checkObjectStorage, type ObjectStorageStatus } from '@/server/lib/object-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** ใช้ตรวจสอบว่าแอปเชื่อมต่อ Neon (Postgres + Object Storage) ได้หรือไม่ */
export async function GET() {
  const timestamp = new Date().toISOString();

  let databaseUp = false;
  try {
    await getDb().execute(sql`select 1`);
    databaseUp = true;
  } catch {
    databaseUp = false;
  }

  const storage: ObjectStorageStatus = await checkObjectStorage();
  const degraded = !databaseUp || storage === 'down';

  return Response.json(
    {
      status: degraded ? 'degraded' : 'ok',
      database: databaseUp ? 'up' : 'down',
      storage,
      timestamp,
    },
    { status: databaseUp ? 200 : 503 },
  );
}
