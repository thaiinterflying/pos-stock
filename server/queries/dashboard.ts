import { and, asc, desc, eq, lte, sql } from 'drizzle-orm';

import { getStockStatus, type MovementTypeName, type StockStatus } from '@/lib/stock';

import { getDb } from '../db';
import { products, stockMovements, users } from '../db/schema';

export type DashboardStats = {
  totalActive: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
};

/**
 * นับจำนวน SKU ตามสถานะ (คำนวณสดทุกครั้ง ไม่เก็บสถานะซ้ำในฐานข้อมูล)
 * stock = 0 → หมด, 0 < stock <= min → ใกล้หมด, stock > min → ปกติ
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [row] = await getDb()
    .select({
      totalActive: sql<number>`count(*) filter (where ${products.isActive})::int`,
      inStock:
        sql<number>`count(*) filter (where ${products.isActive} and ${products.currentStock} > ${products.minStock})::int`,
      lowStock:
        sql<number>`count(*) filter (where ${products.isActive} and ${products.currentStock} > 0 and ${products.currentStock} <= ${products.minStock})::int`,
      outOfStock:
        sql<number>`count(*) filter (where ${products.isActive} and ${products.currentStock} = 0)::int`,
    })
    .from(products);

  return row ?? { totalActive: 0, inStock: 0, lowStock: 0, outOfStock: 0 };
}

export type LowStockItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  status: StockStatus;
};

/** สินค้าที่ควรเติม: คงเหลือ <= ยอดขั้นต่ำ (รวมของที่หมดสต๊อก) เรียงของหมดก่อน */
export async function listLowStockProducts(limit = 6): Promise<LowStockItem[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 20);

  const rows = await getDb()
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      unit: products.unit,
      currentStock: products.currentStock,
      minStock: products.minStock,
    })
    .from(products)
    .where(and(eq(products.isActive, true), lte(products.currentStock, products.minStock)))
    .orderBy(
      sql`case when ${products.currentStock} = 0 then 0 else 1 end`,
      asc(products.currentStock),
      asc(products.name),
    )
    .limit(safeLimit);

  return rows.map((row) => ({
    ...row,
    status: getStockStatus(row.currentStock, row.minStock),
  }));
}

export type RecentMovementItem = {
  id: string;
  type: MovementTypeName;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  createdAt: Date;
  productId: string;
  productName: string;
  productSku: string;
  productUnit: string;
  performedByName: string;
};

export async function listRecentMovements(limit = 6): Promise<RecentMovementItem[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 20);

  return getDb()
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantityChange: stockMovements.quantityChange,
      quantityBefore: stockMovements.quantityBefore,
      quantityAfter: stockMovements.quantityAfter,
      createdAt: stockMovements.createdAt,
      productId: products.id,
      productName: products.name,
      productSku: products.sku,
      productUnit: products.unit,
      performedByName: users.name,
    })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .innerJoin(users, eq(stockMovements.performedBy, users.id))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(safeLimit);
}
