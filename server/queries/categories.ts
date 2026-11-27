import { asc, eq, sql } from 'drizzle-orm';

import { getDb } from '../db';
import { categories, products } from '../db/schema';

export type CategoryOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export type CategoryWithCounts = CategoryOption & {
  productCount: number;
  activeProductCount: number;
  createdAt: Date;
};

export async function listCategoryOptions(): Promise<CategoryOption[]> {
  return getDb()
    .select({
      id: categories.id,
      name: categories.name,
      isActive: categories.isActive,
    })
    .from(categories)
    .orderBy(asc(categories.name));
}

export async function listCategoriesWithCounts(): Promise<CategoryWithCounts[]> {
  return getDb()
    .select({
      id: categories.id,
      name: categories.name,
      isActive: categories.isActive,
      createdAt: categories.createdAt,
      productCount: sql<number>`count(${products.id})::int`,
      activeProductCount: sql<number>`count(${products.id}) filter (where ${products.isActive})::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id, categories.name, categories.isActive, categories.createdAt)
    .orderBy(asc(categories.name));
}

export async function findCategoryById(
  id: string,
): Promise<{ id: string; name: string; isActive: boolean } | null> {
  const [row] = await getDb()
    .select({ id: categories.id, name: categories.name, isActive: categories.isActive })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  return row ?? null;
}
