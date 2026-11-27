import { z } from 'zod';

import { emailSchema } from './common';

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: 'กรุณากรอกรหัสผ่าน' })
    .min(1, 'กรุณากรอกรหัสผ่าน')
    .max(200, 'รหัสผ่านยาวเกินไป'),
  next: z.string().max(2048).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
