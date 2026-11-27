import { hash, verify, type Algorithm } from '@node-rs/argon2';

// @node-rs/argon2 ประกาศ Algorithm เป็น const enum ซึ่งใช้กับ isolatedModules ไม่ได้
// ค่า Argon2id = 2 ตามลำดับใน enum ของ argon2
const ARGON2ID = 2 as Algorithm;

/** Argon2id ตามคำแนะนำของ OWASP (memory 19 MiB, iterations 2, parallelism 1) */
const HASH_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

let dummyHash: Promise<string> | null = null;

/**
 * ตรวจรหัสผ่าน; ถ้าไม่มี hash (ไม่พบผู้ใช้/ถูกปิดใช้งาน) จะยังคำนวณ argon2
 * กับ dummy hash เพื่อลดความต่างของเวลา (user enumeration ผ่าน timing)
 */
export async function verifyPassword(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  if (!passwordHash) {
    dummyHash ??= hashPassword('tif-stock-timing-safety-placeholder');
    await verify(await dummyHash, password);
    return false;
  }

  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
