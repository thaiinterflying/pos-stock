import { z } from 'zod';

export const categoryNameSchema = z
  .string({ error: 'กรุณากรอกชื่อหมวดหมู่' })
  .trim()
  .min(1, 'กรุณากรอกชื่อหมวดหมู่')
  .max(60, 'ชื่อหมวดหมู่ยาวเกินไป');

export const createCategorySchema = z.object({
  name: categoryNameSchema,
});

export const updateCategorySchema = z.object({
  categoryId: z.string().uuid('หมวดหมู่ไม่ถูกต้อง'),
  name: categoryNameSchema,
});

export const setCategoryActiveSchema = z.object({
  categoryId: z.string().uuid('หมวดหมู่ไม่ถูกต้อง'),
  isActive: z.boolean({ error: 'สถานะไม่ถูกต้อง' }),
});
