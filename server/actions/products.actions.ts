'use server';

import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { authorizeActionAdmin } from '@/server/auth/authorize';
import { getDb } from '@/server/db';
import { categories, products } from '@/server/db/schema';
import { isUniqueViolation } from '@/server/lib/db-errors';
import {
  deleteObjectQuietly,
  isObjectStorageConfigured,
  putObject,
} from '@/server/lib/object-storage';
import { buildProductImageKey, parseProductImage } from '@/server/lib/product-image';
import {
  actionFail,
  actionOk,
  fieldErrorsFromZod,
  type ActionResult,
  type FormState,
} from '@/server/lib/result';
import { applyMovement, adjustToCountedQuantity, StockError } from '@/server/lib/stock-service';
import { findProductById } from '@/server/queries/products';
import {
  createProductSchema,
  productStockAdjustmentSchema,
  setProductActiveSchema,
  updateProductSchema,
} from '@/validations/product';

const PRODUCTS_PATH = '/products';

type CategoryCheck = { ok: true } | { ok: false; message: string };

async function assertCategoryUsable(
  categoryId: string,
  allowInactive: boolean,
): Promise<CategoryCheck> {
  const [category] = await getDb()
    .select({ id: categories.id, isActive: categories.isActive })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    return { ok: false, message: 'ไม่พบหมวดหมู่นี้' };
  }

  if (!category.isActive && !allowInactive) {
    return { ok: false, message: 'หมวดหมู่นี้ถูกปิดใช้งาน กรุณาเลือกหมวดหมู่อื่น' };
  }

  return { ok: true };
}

export async function createProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = createProductSchema.safeParse({
    sku: String(formData.get('sku') ?? ''),
    name: String(formData.get('name') ?? ''),
    categoryId: String(formData.get('categoryId') ?? ''),
    unit: String(formData.get('unit') ?? ''),
    minStock: formData.get('minStock'),
    openingStock: formData.get('openingStock'),
    storageLocation: formData.get('storageLocation'),
    description: formData.get('description'),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  const data = parsed.data;
  const categoryCheck = await assertCategoryUsable(data.categoryId, false);
  if (!categoryCheck.ok) {
    return actionFail('VALIDATION', categoryCheck.message, {
      categoryId: [categoryCheck.message],
    });
  }

  const imageResult = await parseProductImage(formData);
  if (!imageResult.ok) {
    return actionFail('VALIDATION', 'รูปสินค้าไม่ถูกต้อง', { image: [imageResult.message] });
  }

  // อัปโหลดรูปก่อน แล้วค่อย insert: ถ้า DB ล้มเหลวจะลบไฟล์คืน
  let uploadedImageKey: string | null = null;
  if (imageResult.file) {
    if (!isObjectStorageConfigured()) {
      return actionFail('INTERNAL', 'ระบบจัดเก็บรูปภาพยังไม่พร้อมใช้งาน');
    }

    try {
      uploadedImageKey = buildProductImageKey(imageResult.file.extension);
      await putObject(uploadedImageKey, imageResult.file.bytes, imageResult.file.mime);
    } catch {
      return actionFail('INTERNAL', 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่', {
        image: ['อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่'],
      });
    }
  }

  let productId: string;

  try {
    productId = await getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(products)
        .values({
          sku: data.sku,
          name: data.name,
          categoryId: data.categoryId,
          unit: data.unit,
          minStock: data.minStock,
          storageLocation: data.storageLocation,
          description: data.description,
          imageKey: uploadedImageKey,
          imageUpdatedAt: uploadedImageKey ? new Date() : null,
          currentStock: 0,
        })
        .returning({ id: products.id });

      if (!created) {
        throw new Error('ไม่สามารถสร้างสินค้าได้');
      }

      // ยอดเริ่มต้นต้องถูกบันทึกเป็น OPENING movement เสมอ (ถ้ามี)
      if (data.openingStock > 0) {
        await applyMovement(tx, {
          productId: created.id,
          type: 'OPENING',
          quantityChange: data.openingStock,
          performedBy: auth.actor.id,
          requestId: randomUUID(),
          note: 'ยอดยกมา',
        });
      }

      return created.id;
    });
  } catch (error) {
    if (uploadedImageKey) {
      await deleteObjectQuietly(uploadedImageKey);
    }
    if (isUniqueViolation(error)) {
      return actionFail('CONFLICT', 'SKU นี้ถูกใช้งานแล้ว', { sku: ['SKU นี้ถูกใช้งานแล้ว'] });
    }
    if (error instanceof StockError) {
      return actionFail('VALIDATION', error.message);
    }
    return actionFail('INTERNAL', 'ไม่สามารถบันทึกสินค้าได้ กรุณาลองใหม่');
  }

  revalidatePath(PRODUCTS_PATH);
  revalidatePath('/dashboard');
  redirect(`/products/${productId}?created=1`);
}

export async function updateProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = updateProductSchema.safeParse({
    productId: String(formData.get('productId') ?? ''),
    sku: String(formData.get('sku') ?? ''),
    name: String(formData.get('name') ?? ''),
    categoryId: String(formData.get('categoryId') ?? ''),
    unit: String(formData.get('unit') ?? ''),
    minStock: formData.get('minStock'),
    storageLocation: formData.get('storageLocation'),
    description: formData.get('description'),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  const data = parsed.data;

  let existing: Awaited<ReturnType<typeof findProductById>>;
  try {
    existing = await findProductById(data.productId);
  } catch {
    return actionFail('INTERNAL', 'ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่');
  }

  if (!existing) {
    return actionFail('NOT_FOUND', 'ไม่พบสินค้านี้');
  }

  const categoryCheck = await assertCategoryUsable(
    data.categoryId,
    data.categoryId === existing.categoryId,
  );
  if (!categoryCheck.ok) {
    return actionFail('VALIDATION', categoryCheck.message, {
      categoryId: [categoryCheck.message],
    });
  }

  const imageResult = await parseProductImage(formData);
  if (!imageResult.ok) {
    return actionFail('VALIDATION', 'รูปสินค้าไม่ถูกต้อง', { image: [imageResult.message] });
  }

  // ปรับจำนวนคงเหลือ (ไม่บังคับ): เว้นว่าง = ไม่ปรับ
  const rawCountedQuantity = formData.get('countedQuantity');
  const adjustingStock = String(rawCountedQuantity ?? '').trim() !== '';
  let stockAdjustment: { countedQuantity: number; reason: string; requestId: string } | null = null;

  if (adjustingStock) {
    const parsedAdjustment = productStockAdjustmentSchema.safeParse({
      countedQuantity: rawCountedQuantity,
      reason: formData.get('reason'),
      requestId: String(formData.get('adjustmentRequestId') ?? ''),
    });

    if (!parsedAdjustment.success) {
      return actionFail(
        'VALIDATION',
        'กรุณาตรวจสอบข้อมูลการปรับจำนวนคงเหลือ',
        fieldErrorsFromZod(parsedAdjustment.error),
      );
    }

    const { countedQuantity, reason, requestId } = parsedAdjustment.data;
    if (countedQuantity === null || !reason) {
      return actionFail('VALIDATION', 'ข้อมูลการปรับยอดไม่ถูกต้อง', {
        countedQuantity: ['ข้อมูลการปรับยอดไม่ถูกต้อง'],
      });
    }

    stockAdjustment = { countedQuantity, reason, requestId };
  }

  let uploadedImageKey: string | null = null;
  if (imageResult.file) {
    if (!isObjectStorageConfigured()) {
      return actionFail('INTERNAL', 'ระบบจัดเก็บรูปภาพยังไม่พร้อมใช้งาน');
    }

    try {
      uploadedImageKey = buildProductImageKey(imageResult.file.extension);
      await putObject(uploadedImageKey, imageResult.file.bytes, imageResult.file.mime);
    } catch {
      return actionFail('INTERNAL', 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่', {
        image: ['อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่'],
      });
    }
  }

  const imageChanged =
    Boolean(uploadedImageKey) || (imageResult.remove && Boolean(existing.imageKey));
  const nextImageKey = uploadedImageKey ?? (imageResult.remove ? null : existing.imageKey);

  let adjustmentResult: { changed: boolean; replayed: boolean } | null;

  try {
    adjustmentResult = await getDb().transaction(async (tx) => {
      // ตั้งใจไม่อัปเดต current_stock ในฟอร์มแก้ไขสินค้า
      // การเปลี่ยนยอดต้องผ่าน stock service เพื่อบันทึกประวัติเสมอ
      await tx
        .update(products)
        .set({
          sku: data.sku,
          name: data.name,
          categoryId: data.categoryId,
          unit: data.unit,
          minStock: data.minStock,
          storageLocation: data.storageLocation,
          description: data.description,
          imageKey: nextImageKey,
          imageUpdatedAt: imageChanged ? new Date() : existing.imageUpdatedAt,
          updatedAt: new Date(),
        })
        .where(eq(products.id, data.productId));

      if (!stockAdjustment) return null;

      const result = await adjustToCountedQuantity(tx, {
        productId: data.productId,
        countedQuantity: stockAdjustment.countedQuantity,
        reason: stockAdjustment.reason,
        performedBy: auth.actor.id,
        requestId: stockAdjustment.requestId,
      });

      return { changed: result.changed, replayed: result.replayed };
    });
  } catch (error) {
    if (uploadedImageKey) {
      await deleteObjectQuietly(uploadedImageKey);
    }
    if (isUniqueViolation(error)) {
      return actionFail('CONFLICT', 'SKU นี้ถูกใช้งานแล้ว', { sku: ['SKU นี้ถูกใช้งานแล้ว'] });
    }
    if (error instanceof StockError) {
      return actionFail('VALIDATION', error.message);
    }
    return actionFail('INTERNAL', 'ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่');
  }

  // ลบไฟล์เดิมหลัง DB commit สำเร็จ (best-effort)
  if (imageChanged && existing.imageKey) {
    await deleteObjectQuietly(existing.imageKey);
  }

  const wasAdjusted = adjustmentResult?.changed === true;
  if (wasAdjusted) {
    revalidatePath('/history');
  }

  revalidatePath(PRODUCTS_PATH);
  revalidatePath(`/products/${data.productId}`);
  revalidatePath('/dashboard');
  redirect(`/products/${data.productId}?updated=1${wasAdjusted ? '&adjusted=1' : ''}`);
}

export async function setProductActiveAction(input: {
  productId: string;
  isActive: boolean;
}): Promise<ActionResult<null>> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = setProductActiveSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail('VALIDATION', 'ข้อมูลไม่ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  try {
    const existing = await findProductById(parsed.data.productId);
    if (!existing) {
      return actionFail('NOT_FOUND', 'ไม่พบสินค้านี้');
    }

    await getDb()
      .update(products)
      .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
      .where(eq(products.id, parsed.data.productId));
  } catch {
    return actionFail('INTERNAL', 'ไม่สามารถอัปเดตสถานะสินค้าได้ กรุณาลองใหม่');
  }

  revalidatePath(PRODUCTS_PATH);
  revalidatePath(`/products/${parsed.data.productId}`);
  revalidatePath('/dashboard');
  return actionOk(
    null,
    parsed.data.isActive ? 'เปิดใช้งานสินค้าแล้ว' : 'ปิดใช้งานสินค้าแล้ว',
  );
}
