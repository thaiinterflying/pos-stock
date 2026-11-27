import { and, eq, gt, lt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { cache } from 'react';

import { SESSION_COOKIE_NAME, SESSION_TTL_HOURS } from '@/lib/constants';
import type { CurrentUser } from '@/lib/types';

import { getDb } from '../db';
import { sessions, users } from '../db/schema';
import { getClientIp, getUserAgent } from '../lib/request';
import { generateSessionToken, hashSessionToken } from './tokens';

const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60_000;

/**
 * อ่านผู้ใช้ปัจจุบันจาก session cookie (ตรวจกับ DB ทุกครั้ง)
 * ใช้ cache() เพื่อ dedupe ภายใน request เดียว (layout + page)
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!row) return null;

  if (Date.now() - row.lastSeenAt.getTime() > LAST_SEEN_UPDATE_INTERVAL_MS) {
    try {
      await db
        .update(sessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(sessions.id, row.sessionId));
    } catch {
      // best-effort: ไม่ให้การอัปเดต last_seen_at ทำให้การยืนยันตัวตนล้มเหลว
    }
  }

  return { id: row.id, name: row.name, email: row.email, role: row.role };
});

/** สร้าง session ใหม่และตั้ง HttpOnly cookie (เรียกได้จาก Server Action เท่านั้น) */
export async function createSession(userId: string): Promise<void> {
  const db = getDb();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);

  // เก็บกวาด session ที่หมดอายุแบบ opportunistic
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    ip,
    userAgent,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await getDb()
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** เพิกถอนทุก session ของผู้ใช้ (ใช้เมื่อปิดใช้งานหรือรีเซ็ตรหัสผ่าน) */
export async function revokeUserSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}
