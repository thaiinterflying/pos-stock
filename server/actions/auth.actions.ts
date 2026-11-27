'use server';

import { redirect } from 'next/navigation';

import { safeInternalPath } from '@/lib/utils';

import { verifyPassword } from '@/server/auth/password';
import { checkLoginRateLimit, recordLoginAttempt } from '@/server/auth/rate-limit';
import { createSession, destroyCurrentSession } from '@/server/auth/session';
import { getClientIp } from '@/server/lib/request';
import { actionFail, fieldErrorsFromZod, type FormState } from '@/server/lib/result';
import { findUserByEmail } from '@/server/queries/users';
import { loginSchema } from '@/validations/auth';

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    next: formData.get('next') ? String(formData.get('next')) : undefined,
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  const { email, password, next } = parsed.data;
  const ip = await getClientIp();

  let user: Awaited<ReturnType<typeof findUserByEmail>>;
  try {
    const { limited } = await checkLoginRateLimit(email, ip);
    if (limited) {
      return actionFail(
        'RATE_LIMITED',
        'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่',
      );
    }

    user = await findUserByEmail(email);
  } catch {
    return actionFail('INTERNAL', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่ภายหลัง');
  }

  // ตรวจรหัสผ่านเสมอ (แม้ไม่พบผู้ใช้) เพื่อลด timing leak
  const passwordValid = await verifyPassword(password, user?.isActive ? user.passwordHash : null);

  if (!user || !user.isActive || !passwordValid) {
    try {
      await recordLoginAttempt({ email, ip, succeeded: false });
    } catch {
      // การบันทึกสถิติล้มเหลวไม่ควรปิดกั้นการตอบข้อความผิดพลาดให้ผู้ใช้
    }
    return actionFail('VALIDATION', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }

  try {
    await recordLoginAttempt({ email, ip, succeeded: true });
    await createSession(user.id);
  } catch {
    return actionFail('INTERNAL', 'ไม่สามารถสร้างเซสชันได้ กรุณาลองใหม่ภายหลัง');
  }

  redirect(safeInternalPath(next, '/dashboard'));
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect('/login');
}
