import { z } from 'zod';

import { optionalTrimmedText } from './common';

const requestIdSchema = z.string().uuid('คำขอไม่ถูกต้อง กรุณาลองใหม่');

const positiveQuantitySchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? 0 : value),
  z.coerce
    .number({ error: 'จำนวนต้องเป็นตัวเลข' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(1, 'จำนวนต้องมากกว่า 0')
    .max(1_000_000_000, 'จำนวนมากเกินไป'),
);

const nonNegativeQuantitySchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? -1 : value),
  z.coerce
    .number({ error: 'จำนวนต้องเป็นตัวเลข' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(0, 'จำนวนต้องไม่ติดลบ')
    .max(1_000_000_000, 'จำนวนมากเกินไป'),
);

export const stockInSchema = z.object({
  productId: z.string().uuid('สินค้าไม่ถูกต้อง'),
  quantity: positiveQuantitySchema,
  note: optionalTrimmedText(300, 'หมายเหตุยาวเกินไป'),
  requestId: requestIdSchema,
});

export const stockOutSchema = z.object({
  productId: z.string().uuid('สินค้าไม่ถูกต้อง'),
  quantity: positiveQuantitySchema,
  recipientName: z
    .string({ error: 'กรุณาระบุชื่อผู้เบิก' })
    .trim()
    .min(1, 'กรุณาระบุชื่อผู้เบิก')
    .max(100, 'ชื่อผู้เบิกยาวเกินไป'),
  department: optionalTrimmedText(100, 'แผนกยาวเกินไป'),
  note: optionalTrimmedText(300, 'หมายเหตุยาวเกินไป'),
  requestId: requestIdSchema,
});

export const adjustStockSchema = z.object({
  productId: z.string().uuid('สินค้าไม่ถูกต้อง'),
  countedQuantity: nonNegativeQuantitySchema,
  reason: z
    .string({ error: 'กรุณาระบุเหตุผลในการปรับยอด' })
    .trim()
    .min(3, 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร')
    .max(300, 'เหตุผลยาวเกินไป'),
  requestId: requestIdSchema,
});

export type StockInInput = z.infer<typeof stockInSchema>;
export type StockOutInput = z.infer<typeof stockOutSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
