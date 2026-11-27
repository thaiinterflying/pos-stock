import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from 'drizzle-orm';

import type { MovementTypeName } from '@/lib/stock';

import { getDb } from '../db';
import { products, stockMovements, users } from '../db/schema';

export type StockMovementFilters = {
  q?: string;
  type?: MovementTypeName;
  from?: Date;
  toExclusive?: Date;
};

export type StockHistoryFilters = StockMovementFilters & {
  page?: number;
  pageSize?: number;
};

export type StockHistoryItem = {
  id: string;
  type: MovementTypeName;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  recipientName: string | null;
  department: string | null;
  note: string | null;
  createdAt: Date;
  productId: string;
  productName: string;
  productSku: string;
  productUnit: string;
  performedByName: string;
};

export type StockHistoryResult = {
  items: StockHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function buildWhereClause(filters: StockMovementFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    const search = or(ilike(products.name, pattern), ilike(products.sku, pattern));
    if (search) conditions.push(search);
  }

  if (filters.type) {
    conditions.push(eq(stockMovements.type, filters.type));
  }

  if (filters.from) {
    conditions.push(gte(stockMovements.createdAt, filters.from));
  }

  if (filters.toExclusive) {
    conditions.push(lt(stockMovements.createdAt, filters.toExclusive));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listStockMovements(
  filters: StockHistoryFilters = {},
): Promise<StockHistoryResult> {
  const db = getDb();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
  const requestedPage = Math.max(filters.page ?? 1, 1);
  const whereClause = buildWhereClause(filters);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .where(whereClause);

  const total = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const items = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantityChange: stockMovements.quantityChange,
      quantityBefore: stockMovements.quantityBefore,
      quantityAfter: stockMovements.quantityAfter,
      recipientName: stockMovements.recipientName,
      department: stockMovements.department,
      note: stockMovements.note,
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
    .where(whereClause)
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total, page, pageSize, totalPages };
}

/**
 * ดึงรายการสำหรับ Export CSV (ไม่ทำ pagination)
 * จำกัดจำนวนสูงสุด 50,000 แถวเพื่อไม่ให้ memory บน server บานปลาย
 */
export async function listStockMovementsForExport(
  filters: StockMovementFilters = {},
  maxRows = 50_000,
): Promise<StockHistoryItem[]> {
  const safeLimit = Math.min(Math.max(maxRows, 1), 50_000);

  return getDb()
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantityChange: stockMovements.quantityChange,
      quantityBefore: stockMovements.quantityBefore,
      quantityAfter: stockMovements.quantityAfter,
      recipientName: stockMovements.recipientName,
      department: stockMovements.department,
      note: stockMovements.note,
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
    .where(buildWhereClause(filters))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(safeLimit);
}

export async function findMovementByRequestId(requestId: string) {
  const [row] = await getDb()
    .select({
      id: stockMovements.id,
      productId: stockMovements.productId,
      type: stockMovements.type,
      quantityChange: stockMovements.quantityChange,
      quantityBefore: stockMovements.quantityBefore,
      quantityAfter: stockMovements.quantityAfter,
      createdAt: stockMovements.createdAt,
      productUnit: products.unit,
    })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .where(eq(stockMovements.requestId, requestId))
    .limit(1);

  return row ?? null;
}
