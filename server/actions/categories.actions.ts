'use server';

import { and, eq, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { authorizeActionAdmin } from '@/server/auth/authorize';
import { getDb } from '@/server/db';
import { categories, products } from '@/server/db/schema';
import { isUniqueViolation } from '@/server/lib/db-errors';
import {
  actionFail,
  actionOk,
  fieldErrorsFromZod,
  type ActionResult,
  type FormState,
} from '@/server/lib/result';
import { findCategoryById } from '@/server/queries/categories';
import {
  createCategorySchema,
  setCategoryActiveSchema,
  updateCategorySchema,
} from '@/validations/category';

const CATEGORIES_PATH = '/settings/categories';
const DUPLICATE_MESSAGE = 'ชื่อหมวดหมู่นี้ถูกใช้งานแล้ว';

async function isDuplicateName(name: string, excludeCategoryId?: string): Promise<boolean> {
  const nameMatch = sql`lower(${categories.name}) = lower(${name})`;
  const whereClause = excludeCategoryId
    ? and(nameMatch, ne(categories.id, excludeCategoryId))
    : nameMatch;

  const [row] = await getDb()
    .select({ id: categories.id })
    .from(categories)
    .where(whereClause)
    .limit(1);

  return Boolean(row);
}

export async function createCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = createCategorySchema.safeParse({
    name: String(formData.get('name') ?? ''),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  try {
    if (await isDuplicateName(parsed.data.name)) {
      return actionFail('CONFLICT', DUPLICATE_MESSAGE, { name: [DUPLICATE_MESSAGE] });
    }

    await getDb().insert(categories).values({ name: parsed.data.name });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return actionFail('CONFLICT', DUPLICATE_MESSAGE, { name: [DUPLICATE_MESSAGE] });
    }
    return actionFail('INTERNAL', 'ไม่สามารถบันทึกหมวดหมู่ได้ กรุณาลองใหม่');
  }

  revalidatePath(CATEGORIES_PATH);
  revalidatePath('/products');
  return actionOk(null, 'เพิ่มหมวดหมู่เรียบร้อยแล้ว');
}

export async function updateCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = updateCategorySchema.safeParse({
    categoryId: String(formData.get('categoryId') ?? ''),
    name: String(formData.get('name') ?? ''),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  try {
    const existing = await findCategoryById(parsed.data.categoryId);
    if (!existing) {
      return actionFail('NOT_FOUND', 'ไม่พบหมวดหมู่นี้');
    }

    if (await isDuplicateName(parsed.data.name, parsed.data.categoryId)) {
      return actionFail('CONFLICT', DUPLICATE_MESSAGE, { name: [DUPLICATE_MESSAGE] });
    }

    await getDb()
      .update(categories)
      .set({ name: parsed.data.name })
      .where(eq(categories.id, parsed.data.categoryId));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return actionFail('CONFLICT', DUPLICATE_MESSAGE, { name: [DUPLICATE_MESSAGE] });
    }
    return actionFail('INTERNAL', 'ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่');
  }

  revalidatePath(CATEGORIES_PATH);
  revalidatePath('/products');
  return actionOk(null, 'บันทึกชื่อหมวดหมู่เรียบร้อยแล้ว');
}

export async function setCategoryActiveAction(input: {
  categoryId: string;
  isActive: boolean;
}): Promise<ActionResult<null>> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = setCategoryActiveSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail('VALIDATION', 'ข้อมูลไม่ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  try {
    const existing = await findCategoryById(parsed.data.categoryId);
    if (!existing) {
      return actionFail('NOT_FOUND', 'ไม่พบหมวดหมู่นี้');
    }

    if (!parsed.data.isActive) {
      const [row] = await getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(
          and(
            eq(products.categoryId, parsed.data.categoryId),
            eq(products.isActive, true),
          ),
        );

      const activeProducts = row?.count ?? 0;
      if (activeProducts > 0) {
        return actionFail(
          'CONFLICT',
          `หมวดหมู่นี้มีสินค้าที่ใช้งานอยู่ ${activeProducts.toLocaleString('th-TH')} รายการ กรุณาย้ายหรือปิดใช้งานสินค้าเหล่านั้นก่อน`,
        );
      }
    }

    await getDb()
      .update(categories)
      .set({ isActive: parsed.data.isActive })
      .where(eq(categories.id, parsed.data.categoryId));
  } catch {
    return actionFail('INTERNAL', 'ไม่สามารถอัปเดตสถานะหมวดหมู่ได้ กรุณาลองใหม่');
  }

  revalidatePath(CATEGORIES_PATH);
  revalidatePath('/products');
  return actionOk(
    null,
    parsed.data.isActive ? 'เปิดใช้งานหมวดหมู่แล้ว' : 'ปิดใช้งานหมวดหมู่แล้ว',
  );
}
