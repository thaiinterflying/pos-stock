import ExcelJS from 'exceljs';

import { formatDateTimeForCsv } from '@/lib/format';
import { MOVEMENT_TYPE_LABELS } from '@/lib/stock';
import type { StockHistoryItem } from '@/server/queries/stock';

const SHEET_NAME = 'ประวัติการเคลื่อนไหว';

type ColumnKey =
  | 'createdAt'
  | 'type'
  | 'sku'
  | 'name'
  | 'unit'
  | 'quantityChange'
  | 'quantityBefore'
  | 'quantityAfter'
  | 'recipient'
  | 'department'
  | 'note'
  | 'performedBy';

const COLUMNS: Array<{ header: string; key: ColumnKey; width: number }> = [
  { header: 'วันที่ (เวลาไทย)', key: 'createdAt', width: 20 },
  { header: 'ประเภท', key: 'type', width: 14 },
  { header: 'SKU', key: 'sku', width: 18 },
  { header: 'ชื่อสินค้า', key: 'name', width: 36 },
  { header: 'หน่วยนับ', key: 'unit', width: 12 },
  { header: 'จำนวนเปลี่ยนแปลง', key: 'quantityChange', width: 16 },
  { header: 'คงเหลือก่อน', key: 'quantityBefore', width: 14 },
  { header: 'คงเหลือหลัง', key: 'quantityAfter', width: 14 },
  { header: 'ผู้เบิก', key: 'recipient', width: 20 },
  { header: 'แผนก', key: 'department', width: 20 },
  { header: 'หมายเหตุ', key: 'note', width: 34 },
  { header: 'ผู้ดำเนินการ', key: 'performedBy', width: 22 },
];

/**
 * สร้างไฟล์ .xlsx ของ Stock Movement
 * - ข้อมูลชุดเดียวกับ CSV (ฟิลเตอร์และเพดาน 50,000 แถวจาก query เดียวกัน)
 * - วันที่แสดงเป็นเวลาไทยแบบข้อความ เพื่อให้อ่านง่ายและไม่เพี้ยน timezone
 * - เปิด AutoFilter + Freeze แถวหัวตาราง
 */
export async function buildStockMovementsXlsx(
  items: StockHistoryItem[],
): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TIF Stock';
  workbook.company = 'Thai Inter Flying';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 18 },
  });

  sheet.columns = COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };

  for (const item of items) {
    const row = sheet.addRow({
      createdAt: formatDateTimeForCsv(item.createdAt),
      type: MOVEMENT_TYPE_LABELS[item.type],
      sku: item.productSku,
      name: item.productName,
      unit: item.productUnit,
      quantityChange: item.quantityChange,
      quantityBefore: item.quantityBefore,
      quantityAfter: item.quantityAfter,
      recipient: item.recipientName ?? '',
      department: item.department ?? '',
      note: item.note ?? '',
      performedBy: item.performedByName,
    });

    // เขียนค่าตัวเลขลงเป็น number (ไม่ใช่ string) เพื่อให้ Excel คำนวณ/เรียงได้
    (['quantityChange', 'quantityBefore', 'quantityAfter'] as const).forEach((key) => {
      row.getCell(key).value = item[key];
    });
  }

  sheet.getColumn('quantityChange').numFmt = '#,##0;[Red]-#,##0';
  sheet.getColumn('quantityBefore').numFmt = '#,##0';
  sheet.getColumn('quantityAfter').numFmt = '#,##0';

  (['quantityChange', 'quantityBefore', 'quantityAfter'] as const).forEach((key) => {
    sheet.getColumn(key).alignment = { horizontal: 'right' };
  });

  sheet.getColumn('note').alignment = { wrapText: true, vertical: 'top' };

  const buffer = await workbook.xlsx.writeBuffer();
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return bytes;
}
