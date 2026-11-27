import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildStockMovementsXlsx } from '../../server/lib/xlsx';
import type { StockHistoryItem } from '../../server/queries/stock';

const ITEM: StockHistoryItem = {
  id: '9f4c2f0e-3a4b-4c5d-8e9f-0a1b2c3d4e5f',
  type: 'IN',
  quantityChange: 5,
  quantityBefore: 10,
  quantityAfter: 15,
  recipientName: null,
  department: null,
  note: 'ทดสอบภาษาไทย',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  productId: '6f1c2f0e-3a4b-4c5d-8e9f-0a1b2c3d4e5f',
  productName: 'กระดาษ A4 80 แกรม',
  productSku: 'A4-001',
  productUnit: 'รีม',
  performedByName: 'ผู้ดูแลระบบ',
};

describe('buildStockMovementsXlsx', () => {
  it('สร้างไฟล์ .xlsx ที่เปิดอ่านกลับได้ พร้อมหัวตารางและข้อมูลภาษาไทย', async () => {
    const buffer = await buildStockMovementsXlsx([ITEM]);
    expect(buffer.byteLength).toBeGreaterThan(1_000);

    // ไฟล์ .xlsx คือ ZIP (ขึ้นต้นด้วย PK)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer);

    const sheet = workbook.getWorksheet('ประวัติการเคลื่อนไหว');
    expect(sheet).toBeDefined();
    if (!sheet) return;

    // หัวตาราง
    expect(sheet.getCell('A1').value).toBe('วันที่ (เวลาไทย)');
    expect(sheet.getCell('B1').value).toBe('ประเภท');
    expect(sheet.getCell('L1').value).toBe('ผู้ดำเนินการ');

    // ข้อมูลแถวแรก
    expect(sheet.getCell('B2').value).toBe('รับเข้า');
    expect(sheet.getCell('C2').value).toBe('A4-001');
    expect(sheet.getCell('D2').value).toBe('กระดาษ A4 80 แกรม');
    expect(sheet.getCell('F2').value).toBe(5);
    expect(sheet.getCell('G2').value).toBe(10);
    expect(sheet.getCell('H2').value).toBe(15);
    expect(sheet.getCell('K2').value).toBe('ทดสอบภาษาไทย');
    expect(sheet.getCell('L2').value).toBe('ผู้ดูแลระบบ');
  });

  it('สร้างไฟล์ที่มีเฉพาะหัวตารางได้ (ไม่มีข้อมูล)', async () => {
    const buffer = await buildStockMovementsXlsx([]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer);

    const sheet = workbook.getWorksheet('ประวัติการเคลื่อนไหว');
    expect(sheet?.rowCount).toBe(1);
    expect(sheet?.getCell('A1').value).toBe('วันที่ (เวลาไทย)');
  });
});
