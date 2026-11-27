export type StockStatus = 'IN_STOCK' | 'LOW' | 'OUT_OF_STOCK';

export type MovementTypeName = 'OPENING' | 'IN' | 'OUT' | 'ADJUSTMENT';

/**
 * สถานะสต๊อกคำนวณสดจากตัวเลขเท่านั้น (ไม่เก็บซ้ำในฐานข้อมูล)
 * stock = 0 → หมด, 0 < stock <= min_stock → ใกล้หมด, stock > min_stock → ปกติ
 */
export function getStockStatus(currentStock: number, minStock: number): StockStatus {
  if (currentStock <= 0) return 'OUT_OF_STOCK';
  if (currentStock <= minStock) return 'LOW';
  return 'IN_STOCK';
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  IN_STOCK: 'ปกติ',
  LOW: 'ใกล้หมด',
  OUT_OF_STOCK: 'หมดสต๊อก',
};

export const MOVEMENT_TYPE_LABELS: Record<MovementTypeName, string> = {
  OPENING: 'ยอดยกมา',
  IN: 'รับเข้า',
  OUT: 'เบิกออก',
  ADJUSTMENT: 'ปรับยอด',
};

export function formatSignedQuantity(value: number): string {
  const absolute = Math.abs(value).toLocaleString('th-TH');
  return value > 0 ? `+${absolute}` : `-${absolute}`;
}

export function stockStatusToParam(status: StockStatus): 'in_stock' | 'low' | 'out' {
  if (status === 'OUT_OF_STOCK') return 'out';
  if (status === 'LOW') return 'low';
  return 'in_stock';
}

export function parseStockStatusParam(value: string | undefined): StockStatus | undefined {
  if (value === 'in_stock') return 'IN_STOCK';
  if (value === 'low') return 'LOW';
  if (value === 'out') return 'OUT_OF_STOCK';
  return undefined;
}

export function isMovementTypeName(value: string | undefined): value is MovementTypeName {
  return value === 'OPENING' || value === 'IN' || value === 'OUT' || value === 'ADJUSTMENT';
}
