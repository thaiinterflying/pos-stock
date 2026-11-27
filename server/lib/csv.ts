import { formatDateTimeForCsv } from '@/lib/format';
import { MOVEMENT_TYPE_LABELS } from '@/lib/stock';
import type { StockHistoryItem } from '@/server/queries/stock';

type CsvValue = string | number | null | undefined;
type CsvRow = CsvValue[];

const DELIMITER = ',';
const LINE_BREAK = '\r\n';

/**
 * กัน CSV formula injection: ค่าที่ขึ้นต้นด้วยอักขระที่ Excel ตีความเป็นสูตร
 * จะถูกเติม apostrophe นำหน้า (Excel แสดงเป็น text)
 * ตัวเลขจริง (เช่น -3) ไม่ถูกเติม เพื่อให้คำนวณใน Excel ได้
 */
function protectFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);

  const safe = protectFormula(value);

  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}

export function toCsv(rows: CsvRow[]): string {
  return rows.map((row) => row.map(csvCell).join(DELIMITER)).join(LINE_BREAK);
}

const HEADERS: CsvRow = [
  'วันที่ (เวลาไทย)',
  'ประเภท',
  'SKU',
  'ชื่อสินค้า',
  'หน่วยนับ',
  'จำนวนเปลี่ยนแปลง',
  'คงเหลือก่อน',
  'คงเหลือหลัง',
  'ผู้เบิก',
  'แผนก',
  'หมายเหตุ',
  'ผู้ดำเนินการ',
];

/** สร้าง CSV ของ Stock Movement พร้อม UTF-8 BOM เพื่อให้ Excel อ่านภาษาไทยได้ */
export function buildStockMovementsCsv(items: StockHistoryItem[]): string {
  const rows: CsvRow[] = [
    HEADERS,
    ...items.map((item) => [
      formatDateTimeForCsv(item.createdAt),
      MOVEMENT_TYPE_LABELS[item.type],
      item.productSku,
      item.productName,
      item.productUnit,
      item.quantityChange,
      item.quantityBefore,
      item.quantityAfter,
      item.recipientName ?? '',
      item.department ?? '',
      item.note ?? '',
      item.performedByName,
    ]),
  ];

  return `\uFEFF${toCsv(rows)}${LINE_BREAK}`;
}
