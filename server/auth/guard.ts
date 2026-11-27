import { redirect } from 'next/navigation';

import type { CurrentUser } from '@/lib/types';

import { getCurrentUser } from './session';

/**
 * Guard สำหรับหน้า/Server Action: ต้อง login ก่อน
 * Authorization ต้องตรวจฝั่ง server เสมอ ไม่พึ่งการซ่อนปุ่มฝั่ง client
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Guard สำหรับหน้า/Server Action ของผู้ดูแลระบบเท่านั้น */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard?forbidden=1');
  return user;
}
