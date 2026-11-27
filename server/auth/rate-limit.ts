import { createHmac } from 'node:crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';

import { getDb } from '../db';
import { loginAttempts } from '../db/schema';

export const LOGIN_WINDOW_MINUTES = 15;
const MAX_EMAIL_FAILURES = 5;
const MAX_IP_FAILURES = 20;
const ATTEMPT_RETENTION_HOURS = 24;

function getPepper(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ต้องกำหนด AUTH_SECRET (อย่างน้อย 16 ตัวอักษร) ใน environment');
  }

  return 'tif-stock-development-pepper';
}

/** ไม่เก็บอีเมลจริงใน login_attempts — เก็บเฉพาะ HMAC */
function hashEmail(email: string): string {
  return createHmac('sha256', getPepper())
    .update(email.trim().toLowerCase())
    .digest('hex');
}

export type RateLimitResult = { limited: boolean };

/**
 * จำกัด brute force 2 ชั้น: ต่ออีเมล (5 ครั้ง/15 นาที) และต่อ IP (20 ครั้ง/15 นาที)
 * ถ้าถูกจำกัด ต้องตอบข้อความกลาง ๆ ไม่บอกว่าบัญชีมีอยู่จริงหรือไม่
 */
export async function checkLoginRateLimit(
  email: string,
  ip: string | null,
): Promise<RateLimitResult> {
  const db = getDb();
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000);
  const emailHash = hashEmail(email);

  const [emailAttempts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.emailHash, emailHash),
        eq(loginAttempts.succeeded, false),
        gt(loginAttempts.createdAt, since),
      ),
    );

  if ((emailAttempts?.count ?? 0) >= MAX_EMAIL_FAILURES) {
    return { limited: true };
  }

  if (ip) {
    const [ipAttempts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ip, ip),
          eq(loginAttempts.succeeded, false),
          gt(loginAttempts.createdAt, since),
        ),
      );

    if ((ipAttempts?.count ?? 0) >= MAX_IP_FAILURES) {
      return { limited: true };
    }
  }

  return { limited: false };
}

export async function recordLoginAttempt(input: {
  email: string;
  ip: string | null;
  succeeded: boolean;
}): Promise<void> {
  const db = getDb();
  const emailHash = hashEmail(input.email);

  await db.insert(loginAttempts).values({
    emailHash,
    ip: input.ip,
    succeeded: input.succeeded,
  });

  if (input.succeeded) {
    // login สำเร็จ = ล้างประวัติผิดพลาดของอีเมลนี้
    await db
      .delete(loginAttempts)
      .where(and(eq(loginAttempts.emailHash, emailHash), eq(loginAttempts.succeeded, false)));
  }

  await db.delete(loginAttempts).where(
    lt(loginAttempts.createdAt, new Date(Date.now() - ATTEMPT_RETENTION_HOURS * 60 * 60 * 1000)),
  );
}
