import { and, asc, desc, eq, ilike, lte, or, sql, type SQL } from 'drizzle-orm';

import type { MovementTypeName, StockStatus } from '@/lib/stock';

import { getDb } from '../db';
import { categories, products, stockMovements, users } from '../db/schema';

export type ProductListFilters = {
  q?: string;
  categoryId?: string;
  status?: StockStatus;
  /** ใกล้หมดหรือหมดสต๊อก (current_stock <= min_stock) */
  attention?: boolean;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  storageLocation: string | null;
  isActive: boolean;
  categoryName: string;
  status: StockStatus;
  imageUpdatedAt: Date | null;
};

export type ProductListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ProductDetail = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  storageLocation: string | null;
  description: string | null;
  /** object key ภายใน bucket — ใช้ฝั่ง server เท่านั้น */
  imageKey: string | null;
  imageUpdatedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  categoryId: string;
  categoryName: string;
  categoryIsActive: boolean;
};

export type ProductMovementItem = {
  id: string;
  type: MovementTypeName;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  recipientName: string | null;
  department: string | null;
  note: string | null;
  createdAt: Date;
  performedByName: string;
};

const statusExpression = sql<StockStatus>`case
  when ${products.currentStock} = 0 then 'OUT_OF_STOCK'
  when ${products.currentStock} <= ${products.minStock} then 'LOW'
  else 'IN_STOCK'
end`;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function listProducts(
  filters: ProductListFilters = {},
): Promise<ProductListResult> {
  const db = getDb();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
  const requestedPage = Math.max(filters.page ?? 1, 1);
  const conditions: SQL[] = [];

  if (!filters.includeInactive) {
    conditions.push(eq(products.isActive, true));
  }

  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    const search = or(ilike(products.name, pattern), ilike(products.sku, pattern));
    if (search) conditions.push(search);
  }

  if (filters.categoryId) {
    conditions.push(eq(products.categoryId, filters.categoryId));
  }

  if (filters.status) {
    conditions.push(sql`${statusExpression} = ${filters.status}`);
  }

  if (filters.attention) {
    conditions.push(lte(products.currentStock, products.minStock));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(whereClause);

  const total = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const items = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      unit: products.unit,
      currentStock: products.currentStock,
      minStock: products.minStock,
      storageLocation: products.storageLocation,
      isActive: products.isActive,
      categoryName: categories.name,
      status: statusExpression,
      imageUpdatedAt: products.imageUpdatedAt,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(whereClause)
    .orderBy(asc(products.name), asc(products.sku))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total, page, pageSize, totalPages };
}

export async function findProductById(id: string): Promise<ProductDetail | null> {
  const [row] = await getDb()
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      unit: products.unit,
      currentStock: products.currentStock,
      minStock: products.minStock,
      storageLocation: products.storageLocation,
      description: products.description,
      imageKey: products.imageKey,
      imageUpdatedAt: products.imageUpdatedAt,
      isActive: products.isActive,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categoryIsActive: categories.isActive,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);

  return row ?? null;
}

export async function listProductMovements(
  productId: string,
  limit = 20,
): Promise<ProductMovementItem[]> {
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
      performedByName: users.name,
    })
    .from(stockMovements)
    .innerJoin(users, eq(stockMovements.performedBy, users.id))
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
}
