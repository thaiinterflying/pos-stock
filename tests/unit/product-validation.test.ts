import { describe, expect, it } from 'vitest';

import { createProductSchema, productStockAdjustmentSchema } from '../../validations/product';

const CATEGORY_ID = '6f1c2f0e-3a4b-4c5d-8e9f-0a1b2c3d4e5f';
const REQUEST_ID = '3f1c2f0e-3a4b-4c5d-8e9f-0a1b2c3d4e5f';

const baseInput = {
  sku: ' a4-001 ',
  name: 'กระดาษ A4 80 แกรม',
  categoryId: CATEGORY_ID,
  unit: 'รีม',
  minStock: '10',
  openingStock: '',
  storageLocation: '   ',
  description: '',
};

describe('createProductSchema', () => {
  it('แปลง SKU เป็นตัวพิมพ์ใหญ่ ตัดช่องว่าง และแปลงช่องว่างเป็น null', () => {
    const result = createProductSchema.safeParse(baseInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sku).toBe('A4-001');
      expect(result.data.minStock).toBe(10);
      expect(result.data.openingStock).toBe(0);
      expect(result.data.storageLocation).toBeNull();
      expect(result.data.description).toBeNull();
    }
  });

  it('ยอมรับยอดเริ่มต้นเป็นจำนวนเต็มบวก', () => {
    const result = createProductSchema.safeParse({
      ...baseInput,
      openingStock: '24',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openingStock).toBe(24);
    }
  });

  it('ปฏิเสธจำนวนติดลบและจำนวนที่ไม่ใช่จำนวนเต็ม', () => {
    expect(
      createProductSchema.safeParse({ ...baseInput, minStock: '-1' }).success,
    ).toBe(false);

    expect(
      createProductSchema.safeParse({ ...baseInput, openingStock: '1.5' }).success,
    ).toBe(false);
  });

  it('ปฏิเสธ SKU ที่มีอักขระต้องห้าม', () => {
    const result = createProductSchema.safeParse({
      ...baseInput,
      sku: 'A4/001',
    });

    expect(result.success).toBe(false);
  });

  it('ปฏิเสธหมวดหมู่ที่ไม่ใช่ UUID', () => {
    const result = createProductSchema.safeParse({
      ...baseInput,
      categoryId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  it('ปฏิเสธชื่อสินค้าว่าง', () => {
    const result = createProductSchema.safeParse({
      ...baseInput,
      name: '   ',
    });

    expect(result.success).toBe(false);
  });
});

describe('productStockAdjustmentSchema', () => {
  it('เว้นว่างทั้งสองช่อง = ไม่ปรับยอด', () => {
    const result = productStockAdjustmentSchema.safeParse({
      countedQuantity: '',
      reason: '',
      requestId: REQUEST_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countedQuantity).toBeNull();
      expect(result.data.reason).toBeNull();
    }
  });

  it('ยอมรับจำนวนที่นับได้พร้อมเหตุผล', () => {
    const result = productStockAdjustmentSchema.safeParse({
      countedQuantity: '25',
      reason: '  ตรวจนับประจำเดือน  ',
      requestId: REQUEST_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countedQuantity).toBe(25);
      expect(result.data.reason).toBe('ตรวจนับประจำเดือน');
    }
  });

  it('บังคับเหตุผลเมื่อมีการแก้จำนวน', () => {
    const result = productStockAdjustmentSchema.safeParse({
      countedQuantity: '25',
      reason: '',
      requestId: REQUEST_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('reason'))).toBe(true);
    }
  });

  it('ปฏิเสธเหตุผลที่สั้นกว่า 3 ตัวอักษร', () => {
    const result = productStockAdjustmentSchema.safeParse({
      countedQuantity: '5',
      reason: 'ok',
      requestId: REQUEST_ID,
    });

    expect(result.success).toBe(false);
  });

  it('ปฏิเสธจำนวนติดลบหรือไม่ใช่จำนวนเต็ม', () => {
    for (const countedQuantity of ['-1', '1.5']) {
      const result = productStockAdjustmentSchema.safeParse({
        countedQuantity,
        reason: 'ตรวจนับประจำเดือน',
        requestId: REQUEST_ID,
      });

      expect(result.success).toBe(false);
    }
  });

  it('ปฏิเสธ requestId ที่ไม่ใช่ UUID', () => {
    const result = productStockAdjustmentSchema.safeParse({
      countedQuantity: '5',
      reason: 'ตรวจนับประจำเดือน',
      requestId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });
});
