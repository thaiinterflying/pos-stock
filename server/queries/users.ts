import { asc, eq } from 'drizzle-orm';

import type { UserSummary } from '@/lib/types';

import { getDb } from '../db';
import { users, type User } from '../db/schema';

export async function findUserByEmail(email: string): Promise<User | null> {
  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  return row ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/** รายชื่อผู้ใช้สำหรับหน้าตั้งค่า (ไม่ดึง password_hash ออกมา) */
export async function listUsers(): Promise<UserSummary[]> {
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
}
