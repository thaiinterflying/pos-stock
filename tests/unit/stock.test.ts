import { describe, expect, it } from 'vitest';

import {
  formatSignedQuantity,
  getStockStatus,
  parseStockStatusParam,
  stockStatusToParam,
} from '../../lib/stock';

describe('getStockStatus', () => {
  it('เป็น OUT_OF_STOCK เมื่อคงเหลือเป็นศูนย์หรือติดลบ', () => {
    expect(getStockStatus(0, 5)).toBe('OUT_OF_STOCK');
    expect(getStockStatus(0, 0)).toBe('OUT_OF_STOCK');
    expect(getStockStatus(-1, 5)).toBe('OUT_OF_STOCK');
  });

  it('เป็น LOW เมื่อคงเหลือมากกว่า 0 และไม่เกินยอดขั้นต่ำ', () => {
    expect(getStockStatus(1, 5)).toBe('LOW');
    expect(getStockStatus(5, 5)).toBe('LOW');
  });

  it('เป็น IN_STOCK เมื่อคงเหลือมากกว่ายอดขั้นต่ำ', () => {
    expect(getStockStatus(6, 5)).toBe('IN_STOCK');
    expect(getStockStatus(5, 0)).toBe('IN_STOCK');
    expect(getStockStatus(1, 0)).toBe('IN_STOCK');
  });
});

describe('formatSignedQuantity', () => {
  it('แสดงเครื่องหมายบวกสำหรับรับเข้า', () => {
    expect(formatSignedQuantity(12)).toBe('+12');
  });

  it('แสดงเครื่องหมายลบสำหรับเบิกออก/ปรับลด', () => {
    expect(formatSignedQuantity(-3)).toBe('-3');
  });
});

describe('stock status param mapping', () => {
  it('แปลงสถานะเป็นค่าใน URL และกลับได้', () => {
    expect(stockStatusToParam('IN_STOCK')).toBe('in_stock');
    expect(stockStatusToParam('LOW')).toBe('low');
    expect(stockStatusToParam('OUT_OF_STOCK')).toBe('out');

    expect(parseStockStatusParam('in_stock')).toBe('IN_STOCK');
    expect(parseStockStatusParam('low')).toBe('LOW');
    expect(parseStockStatusParam('out')).toBe('OUT_OF_STOCK');
  });

  it('คืน undefined สำหรับค่าที่ไม่รู้จัก', () => {
    expect(parseStockStatusParam('')).toBeUndefined();
    expect(parseStockStatusParam('expired')).toBeUndefined();
    expect(parseStockStatusParam(undefined)).toBeUndefined();
  });
});
