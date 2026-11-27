import { z } from 'zod';

import { PASSWORD_MIN_LENGTH } from '@/lib/constants';

export const emailSchema = z
  .string({ error: 'กรุณากรอกอีเมล' })
  .trim()
  .min(1, 'กรุณากรอกอีเมล')
  .max(255, 'อีเมลยาวเกินไป')
  .email('รูปแบบอีเมลไม่ถูกต้อง')
  .transform((value) => value.toLowerCase());

export const passwordPolicySchema = z
  .string({ error: 'กรุณากำหนดรหัสผ่าน' })
  .min(PASSWORD_MIN_LENGTH, `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`)
  .max(200, 'รหัสผ่านยาวเกินไป')
  .regex(/[A-Za-z]/, 'รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษอย่างน้อย 1 ตัว')
  .regex(/[0-9]/, 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว');

/** แปลงช่องข้อความที่ไม่บังคับ: ตัดช่องว่าง และคืน null เมื่อว่าง */
export const optionalTrimmedText = (max: number, message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z.string().max(max, message).nullable(),
  );
