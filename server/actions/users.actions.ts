'use server';

import { and, eq, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { hashPassword } from '@/server/auth/password';
import { authorizeActionAdmin } from '@/server/auth/authorize';
import { revokeUserSessions } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { users } from '@/server/db/schema';
import { isUniqueViolation } from '@/server/lib/db-errors';
import {
  actionFail,
  actionOk,
  fieldErrorsFromZod,
  type ActionResult,
  type FormState,
} from '@/server/lib/result';
import { findUserByEmail, findUserById } from '@/server/queries/users';
import {
  createUserSchema,
  resetPasswordSchema,
  setUserActiveSchema,
  updateUserSchema,
} from '@/validations/user';

const USERS_PATH = '/settings/users';

async function countOtherActiveAdmins(excludeUserId: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true), ne(users.id, excludeUserId)));

  return row?.count ?? 0;
}

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = createUserSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    role: String(formData.get('role') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  try {
    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      return actionFail('CONFLICT', 'อีเมลนี้ถูกใช้งานแล้ว', { email: ['อีเมลนี้ถูกใช้งานแล้ว'] });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    await getDb().insert(users).values({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return actionFail('CONFLICT', 'อีเมลนี้ถูกใช้งานแล้ว', { email: ['อีเมลนี้ถูกใช้งานแล้ว'] });
    }
    return actionFail('INTERNAL', 'ไม่สามารถบันทึกผู้ใช้ได้ กรุณาลองใหม่');
  }

  revalidatePath(USERS_PATH);
  return actionOk(null, 'เพิ่มผู้ใช้เรียบร้อยแล้ว');
}

export async function updateUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = updateUserSchema.safeParse({
    userId: String(formData.get('userId') ?? ''),
    name: String(formData.get('name') ?? ''),
    role: String(formData.get('role') ?? ''),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  try {
    const target = await findUserById(parsed.data.userId);
    if (!target) {
      return actionFail('NOT_FOUND', 'ไม่พบผู้ใช้นี้');
    }

    if (target.id === auth.actor.id && parsed.data.role !== target.role) {
      return actionFail('FORBIDDEN', 'ไม่สามารถเปลี่ยนบทบาทของบัญชีตัวเองได้');
    }

    if (target.role === 'ADMIN' && parsed.data.role !== 'ADMIN') {
      const otherAdmins = await countOtherActiveAdmins(target.id);
      if (otherAdmins === 0) {
        return actionFail('CONFLICT', 'ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน');
      }
    }

    await getDb()
      .update(users)
      .set({ name: parsed.data.name, role: parsed.data.role, updatedAt: new Date() })
      .where(eq(users.id, target.id));
  } catch {
    return actionFail('INTERNAL', 'ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่');
  }

  revalidatePath(USERS_PATH);
  return actionOk(null, 'บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว');
}

export async function setUserActiveAction(input: {
  userId: string;
  isActive: boolean;
}): Promise<ActionResult<null>> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = setUserActiveSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail('VALIDATION', 'ข้อมูลไม่ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  try {
    const target = await findUserById(parsed.data.userId);
    if (!target) {
      return actionFail('NOT_FOUND', 'ไม่พบผู้ใช้นี้');
    }

    if (target.id === auth.actor.id) {
      return actionFail('FORBIDDEN', 'ไม่สามารถปิดใช้งานบัญชีของตัวเองได้');
    }

    if (!parsed.data.isActive && target.role === 'ADMIN') {
      const otherAdmins = await countOtherActiveAdmins(target.id);
      if (otherAdmins === 0) {
        return actionFail('CONFLICT', 'ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน');
      }
    }

    await getDb()
      .update(users)
      .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
      .where(eq(users.id, target.id));

    if (!parsed.data.isActive) {
      await revokeUserSessions(target.id);
    }
  } catch {
    return actionFail('INTERNAL', 'ไม่สามารถอัปเดตสถานะผู้ใช้ได้ กรุณาลองใหม่');
  }

  revalidatePath(USERS_PATH);
  return actionOk(
    null,
    parsed.data.isActive ? 'เปิดใช้งานผู้ใช้แล้ว' : 'ปิดใช้งานผู้ใช้แล้ว',
  );
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = resetPasswordSchema.safeParse({
    userId: String(formData.get('userId') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  try {
    const target = await findUserById(parsed.data.userId);
    if (!target) {
      return actionFail('NOT_FOUND', 'ไม่พบผู้ใช้นี้');
    }

    const passwordHash = await hashPassword(parsed.data.password);

    await getDb()
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, target.id));

    await revokeUserSessions(target.id);
  } catch {
    return actionFail('INTERNAL', 'ไม่สามารถรีเซ็ตรหัสผ่านได้ กรุณาลองใหม่');
  }

  revalidatePath(USERS_PATH);
  return actionOk(null, 'รีเซ็ตรหัสผ่านแล้ว ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์');
}
