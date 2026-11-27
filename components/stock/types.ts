export type StockMovementMode = 'IN' | 'OUT' | 'ADJUST';

export type StockActionProduct = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  minStock: number;
  isActive: boolean;
};
