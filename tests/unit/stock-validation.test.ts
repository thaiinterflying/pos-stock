import { describe, expect, it } from 'vitest';

import { adjustStockSchema, stockInSchema, stockOutSchema } from '../../validations/stock';

const PRODUCT_ID = '6f1c2f0e-3a4b-4c5d-8e9f-0a1b2c3d4e5f';
const REQUEST_ID = '0f1e2d3c-4b5a-4978-8a9b-0c1d2e3f4a5b';

describe('stockInSchema', () => {
  it('ยอมรับจำนวนเต็มบวกและตัดช่องว่างของหมายเหตุ', () => {
    const result = stockInSchema.safeParse({
      productId: PRODUCT_ID,
      quantity: '5',
      note: '  รับจากผู้ขาย  ',
      requestId: REQUEST_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(5);
      expect(result.data.note).toBe('รับจากผู้ขาย');
    }
  });

  it('แปลงหมายเหตุว่างเป็น null', () => {
    const result = stockInSchema.safeParse({
      productId: PRODUCT_ID,
      quantity: '1',
      note: '   ',
      requestId: REQUEST_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBeNull();
  });

  it('ปฏิเสธจำนวน 0, ติดลบ, ทศนิยม และช่องว่าง', () => {
    for (const quantity of ['0', '-1', '1.5', '']) {
      const result = stockInSchema.safeParse({
        productId: PRODUCT_ID,
        quantity,
        note: '',
        requestId: REQUEST_ID,
      });
      expect(result.success, `quantity=${quantity}`).toBe(false);
    }
  });

  it('ปฏิเสธ requestId ที่ไม่ใช่ UUID', () => {
    const result = stockInSchema.safeParse({
      productId: PRODUCT_ID,
      quantity: '1',
      note: '',
      requestId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });
});

describe('stockOutSchema', () => {
  const base = {
    productId: PRODUCT_ID,
    quantity: '2',
    recipientName: 'สมชาย ใจดี',
    department: 'บัญชี',
    note: '',
    requestId: REQUEST_ID,
  };

  it('ยอมรับข้อมูลครบถ้วน', () => {
    expect(stockOutSchema.safeParse(base).success).toBe(true);
  });

  it('บังคับให้ระบุชื่อผู้เบิก', () => {
    const result = stockOutSchema.safeParse({ ...base, recipientName: '   ' });
    expect(result.success).toBe(false);
  });

  it('ปฏิเสธจำนวนที่ไม่มากกว่า 0', () => {
    expect(stockOutSchema.safeParse({ ...base, quantity: '0' }).success).toBe(false);
  });
});

describe('adjustStockSchema', () => {
  const base = {
    productId: PRODUCT_ID,
    countedQuantity: '0',
    reason: 'ตรวจนับประจำเดือน',
    requestId: REQUEST_ID,
  };

  it('ยอมรับจำนวนที่นับได้เป็น 0', () => {
    const result = adjustStockSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.countedQuantity).toBe(0);
  });

  it('บังคับให้ระบุเหตุผลอย่างน้อย 3 ตัวอักษร', () => {
    expect(adjustStockSchema.safeParse({ ...base, reason: '  ' }).success).toBe(false);
    expect(adjustStockSchema.safeParse({ ...base, reason: 'abc' }).success).toBe(true);
  });

  it('ปฏิเสธจำนวนติดลบและทศนิยม', () => {
    expect(adjustStockSchema.safeParse({ ...base, countedQuantity: '-1' }).success).toBe(false);
    expect(adjustStockSchema.safeParse({ ...base, countedQuantity: '1.5' }).success).toBe(false);
  });
});
