import { createHash, randomBytes } from 'node:crypto';

const SESSION_TOKEN_BYTES = 32;

/** สร้าง opaque session token แบบสุ่ม (ส่งให้ browser ผ่าน HttpOnly cookie เท่านั้น) */
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

/** เก็บเฉพาะ hash ของ token ในฐานข้อมูล เผื่อฐานข้อมูลรั่วจะยึด session ไม่ได้ */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
