import { z } from 'zod';

import { emailSchema, passwordPolicySchema } from './common';

export const createUserSchema = z.object({
  name: z
    .string({ error: 'กรุณากรอกชื่อ' })
    .trim()
    .min(1, 'กรุณากรอกชื่อ')
    .max(100, 'ชื่อยาวเกินไป'),
  email: emailSchema,
  role: z.enum(['ADMIN', 'STAFF'], {
    error: 'กรุณาเลือกบทบาท',
  }),
  password: passwordPolicySchema,
});

export const updateUserSchema = z.object({
  userId: z.string().uuid('ผู้ใช้ไม่ถูกต้อง'),
  name: z
    .string({ error: 'กรุณากรอกชื่อ' })
    .trim()
    .min(1, 'กรุณากรอกชื่อ')
    .max(100, 'ชื่อยาวเกินไป'),
  role: z.enum(['ADMIN', 'STAFF'], { error: 'บทบาทไม่ถูกต้อง' }),
});

export const setUserActiveSchema = z.object({
  userId: z.string().uuid('ผู้ใช้ไม่ถูกต้อง'),
  isActive: z.boolean({ error: 'สถานะไม่ถูกต้อง' }),
});

export const resetPasswordSchema = z.object({
  userId: z.string().uuid('ผู้ใช้ไม่ถูกต้อง'),
  password: passwordPolicySchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
