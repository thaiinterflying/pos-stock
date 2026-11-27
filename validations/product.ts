import { z } from 'zod';

import { optionalTrimmedText } from './common';

const skuSchema = z
  .string({ error: 'กรุณากรอก SKU' })
  .trim()
  .min(2, 'SKU ต้องมีอย่างน้อย 2 ตัวอักษร')
  .max(32, 'SKU ยาวเกินไป')
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => /^[A-Z0-9._-]+$/.test(value),
    'SKU ใช้ได้เฉพาะ A–Z, 0–9, จุด (.), ขีดกลาง (-) และขีดล่าง (_)',
  );

const productNameSchema = z
  .string({ error: 'กรุณากรอกชื่อสินค้า' })
  .trim()
  .min(1, 'กรุณากรอกชื่อสินค้า')
  .max(200, 'ชื่อสินค้ายาวเกินไป');

const unitSchema = z
  .string({ error: 'กรุณากรอกหน่วยนับ' })
  .trim()
  .min(1, 'กรุณากรอกหน่วยนับ')
  .max(50, 'หน่วยนับยาวเกินไป');

const stockQuantitySchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? 0 : value),
  z.coerce
    .number({ error: 'จำนวนต้องเป็นตัวเลข' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(0, 'จำนวนต้องไม่ติดลบ')
    .max(1_000_000_000, 'จำนวนมากเกินไป'),
);

/** เว้นว่าง = ไม่ปรับยอด (ต่างจาก stockQuantitySchema ที่ว่าง = 0) */
const optionalCountedQuantitySchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : value),
  z.coerce
    .number({ error: 'จำนวนต้องเป็นตัวเลข' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(0, 'จำนวนต้องไม่ติดลบ')
    .max(1_000_000_000, 'จำนวนมากเกินไป')
    .nullable(),
);

const productBaseSchema = {
  sku: skuSchema,
  name: productNameSchema,
  categoryId: z.string().uuid('กรุณาเลือกหมวดหมู่'),
  unit: unitSchema,
  minStock: stockQuantitySchema,
  storageLocation: optionalTrimmedText(100, 'ตำแหน่งจัดเก็บยาวเกินไป'),
  description: optionalTrimmedText(1000, 'คำอธิบายยาวเกินไป'),
};

export const createProductSchema = z.object({
  ...productBaseSchema,
  openingStock: stockQuantitySchema,
});

export const updateProductSchema = z.object({
  ...productBaseSchema,
  productId: z.string().uuid('สินค้าไม่ถูกต้อง'),
});

/** ใช้เมื่อแก้จำนวนคงเหลือจากฟอร์มแก้ไขสินค้า (ต้องมีเหตุผล) */
export const productStockAdjustmentSchema = z
  .object({
    countedQuantity: optionalCountedQuantitySchema,
    reason: optionalTrimmedText(300, 'เหตุผลยาวเกินไป'),
    requestId: z.string().uuid('คำขอไม่ถูกต้อง กรุณาลองใหม่'),
  })
  .superRefine((data, ctx) => {
    if (data.countedQuantity === null) return;

    if (!data.reason || data.reason.length < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร',
      });
    }
  });

export const setProductActiveSchema = z.object({
  productId: z.string().uuid('สินค้าไม่ถูกต้อง'),
  isActive: z.boolean({ error: 'สถานะไม่ถูกต้อง' }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductStockAdjustmentInput = z.infer<typeof productStockAdjustmentSchema>;
