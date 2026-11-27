import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

import * as relations from './relations';
import * as schema from './schema';

// Neon ใช้ WebSocket ในการทำ interactive transaction (จำเป็นสำหรับ stock mutation)
neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

const fullSchema = { ...schema, ...relations };

export type Database = NeonDatabase<typeof fullSchema>;

/** type ของ transaction client ที่ drizzle ส่งเข้ามาใน db.transaction() */
export type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const globalForDb = globalThis as unknown as {
  __tifStockDb?: Database;
  __tifStockPool?: Pool;
};

/**
 * สร้าง connection แบบ lazy เพื่อให้ `next build` ไม่ต้องเชื่อมต่อฐานข้อมูล
 * และให้ reuse pool เดิมใน dev (HMR)
 */
export function getDb(): Database {
  if (globalForDb.__tifStockDb) {
    return globalForDb.__tifStockDb;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'ไม่พบ DATABASE_URL — กรุณาคัดลอก .env.example เป็น .env.local และใส่ connection string ของ Neon',
    );
  }

  const pool = new Pool({ connectionString, max: 5 });
  const database = drizzle(pool, { schema: fullSchema });
  globalForDb.__tifStockDb = database;
  globalForDb.__tifStockPool = pool;
  return database;
}

/** ปิด pool (ใช้ในสคริปต์ CLI เช่น seed เพื่อให้ process จบได้) */
export async function closeDb(): Promise<void> {
  if (globalForDb.__tifStockPool) {
    await globalForDb.__tifStockPool.end();
    globalForDb.__tifStockPool = undefined;
  }
  globalForDb.__tifStockDb = undefined;
}
