import { describe, expect, it } from 'vitest';

import type { StockHistoryItem } from '../../server/queries/stock';
import {
  buildStockMovementsCsv,
  csvCell,
  toCsv,
} from '../../server/lib/csv';

const SAMPLE_ITEM: StockHistoryItem = {
  id: 'movement-1',
  type: 'OUT',
  quantityChange: -3,
  quantityBefore: 10,
  quantityAfter: 7,
  recipientName: 'สมชาย ใจดี',
  department: 'บัญชี',
  note: 'เบิกใช้ในสำนักงาน',
  createdAt: new Date('2026-01-15T03:30:00Z'),
  productId: 'product-1',
  productName: 'กระดาษ A4 80 แกรม',
  productSku: 'A4-001',
  productUnit: 'รีม',
  performedByName: 'ผู้ดูแลระบบ',
};

describe('csvCell', () => {
  it('ครอบ quote เมื่อมี comma และ escape quote ซ้อน', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('ครอบ quote เมื่อมีขึ้นบรรทัดใหม่', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('ป้องกัน formula injection สำหรับข้อความ', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(csvCell('+66')).toBe("'+66");
    expect(csvCell('-abc')).toBe("'-abc");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });

  it('ไม่เติม apostrophe ให้กับตัวเลขติดลบ', () => {
    expect(csvCell(-3)).toBe('-3');
  });

  it('คืนค่าว่างสำหรับ null/undefined', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('ใช้ CRLF ตาม RFC 4180', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });
});

describe('buildStockMovementsCsv', () => {
  it('เริ่มด้วย UTF-8 BOM และมีหัวตารางภาษาไทย', () => {
    const csv = buildStockMovementsCsv([]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('วันที่ (เวลาไทย)');
    expect(csv).toContain('จำนวนเปลี่ยนแปลง');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('แปลงเวลาตามเขตเวลาไทยและคงเครื่องหมายจำนวนติดลบ', () => {
    const csv = buildStockMovementsCsv([SAMPLE_ITEM]);

    expect(csv).toContain('2026-01-15 10:30:00');
    expect(csv).toContain('เบิกออก');
    expect(csv).toContain('A4-001');
    expect(csv).toContain(',-3,10,7,');
  });

  it('neutralize formula injection ในหมายเหตุ', () => {
    const csv = buildStockMovementsCsv([
      { ...SAMPLE_ITEM, note: '=HYPERLINK("http://example.com")' },
    ]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain(',=HYPERLINK');
  });
});
