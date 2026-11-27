'use server';

import { revalidatePath } from 'next/cache';

import type { MovementTypeName } from '@/lib/stock';

import { authorizeActionAdmin, authorizeActionUser } from '@/server/auth/authorize';
import { getDb } from '@/server/db';
import { isUniqueViolation } from '@/server/lib/db-errors';
import {
  actionFail,
  actionOk,
  fieldErrorsFromZod,
  type FormState,
} from '@/server/lib/result';
import {
  adjustToCountedQuantity,
  applyMovement,
  StockError,
} from '@/server/lib/stock-service';
import { findMovementByRequestId } from '@/server/queries/stock';
import { adjustStockSchema, stockInSchema, stockOutSchema } from '@/validations/stock';

function revalidateStockPaths(productId: string): void {
  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  revalidatePath('/history');
  revalidatePath('/dashboard');
}

async function handleMovementFailure(
  error: unknown,
  context: { productId: string; requestId: string; expectedType: MovementTypeName },
  fallbackMessage: string,
): Promise<FormState> {
  const { productId, requestId, expectedType } = context;

  // ตรวจ request_id ก่อนเสมอ: รองรับทั้ง double submission ที่ insert ชน unique
  // และกรณีที่คำขอแรกสำเร็จไปแล้วแต่คำขอที่สองถูกบล็อกเพราะยอดคงเหลือเปลี่ยน
  try {
    const existing = await findMovementByRequestId(requestId);

    if (existing) {
      if (existing.productId === productId && existing.type === expectedType) {
        return actionOk(
          null,
          `รายการนี้ถูกบันทึกไว้แล้ว · คงเหลือ ${existing.quantityAfter.toLocaleString('th-TH')} ${existing.productUnit}`,
        );
      }

      return actionFail('CONFLICT', 'คำขอนี้ถูกใช้งานแล้ว กรุณาลองใหม่อีกครั้ง');
    }
  } catch {
    // lookup ล้มเหลว: ไปตรวจ error ที่เกิดขึ้นจริงด้านล่าง
  }

  if (isUniqueViolation(error)) {
    return actionFail('CONFLICT', 'คำขอนี้ถูกใช้งานแล้ว กรุณาลองใหม่อีกครั้ง');
  }

  if (error instanceof StockError) {
    if (error.code === 'INSUFFICIENT_STOCK') {
      return actionFail('INSUFFICIENT_STOCK', error.message, { quantity: [error.message] });
    }

    if (error.code === 'PRODUCT_NOT_FOUND' || error.code === 'PRODUCT_INACTIVE') {
      return actionFail('CONFLICT', error.message);
    }

    return actionFail('VALIDATION', error.message);
  }

  return actionFail('INTERNAL', fallbackMessage);
}

export async function stockInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeActionUser();
  if (!auth.ok) return auth.failure;

  const parsed = stockInSchema.safeParse({
    productId: String(formData.get('productId') ?? ''),
    quantity: formData.get('quantity'),
    note: formData.get('note'),
    requestId: String(formData.get('requestId') ?? ''),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  const data = parsed.data;

  try {
    const result = await getDb().transaction((tx) =>
      applyMovement(tx, {
        productId: data.productId,
        type: 'IN',
        quantityChange: data.quantity,
        note: data.note,
        performedBy: auth.actor.id,
        requestId: data.requestId,
      }),
    );

    revalidateStockPaths(data.productId);
    return actionOk(
      null,
      `รับเข้า ${data.quantity.toLocaleString('th-TH')} สำเร็จ · คงเหลือ ${result.quantityAfter.toLocaleString('th-TH')}`,
    );
  } catch (error) {
    return handleMovementFailure(
      error,
      { productId: data.productId, requestId: data.requestId, expectedType: 'IN' },
      'ไม่สามารถรับสินค้าเข้าได้',
    );
  }
}

export async function stockOutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeActionUser();
  if (!auth.ok) return auth.failure;

  const parsed = stockOutSchema.safeParse({
    productId: String(formData.get('productId') ?? ''),
    quantity: formData.get('quantity'),
    recipientName: String(formData.get('recipientName') ?? ''),
    department: formData.get('department'),
    note: formData.get('note'),
    requestId: String(formData.get('requestId') ?? ''),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  const data = parsed.data;

  try {
    const result = await getDb().transaction((tx) =>
      applyMovement(tx, {
        productId: data.productId,
        type: 'OUT',
        quantityChange: -data.quantity,
        recipientName: data.recipientName,
        department: data.department,
        note: data.note,
        performedBy: auth.actor.id,
        requestId: data.requestId,
      }),
    );

    revalidateStockPaths(data.productId);
    return actionOk(
      null,
      `เบิกออก ${data.quantity.toLocaleString('th-TH')} สำเร็จ · คงเหลือ ${result.quantityAfter.toLocaleString('th-TH')}`,
    );
  } catch (error) {
    return handleMovementFailure(
      error,
      { productId: data.productId, requestId: data.requestId, expectedType: 'OUT' },
      'ไม่สามารถเบิกสินค้าออกได้',
    );
  }
}

export async function adjustStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeActionAdmin();
  if (!auth.ok) return auth.failure;

  const parsed = adjustStockSchema.safeParse({
    productId: String(formData.get('productId') ?? ''),
    countedQuantity: formData.get('countedQuantity'),
    reason: String(formData.get('reason') ?? ''),
    requestId: String(formData.get('requestId') ?? ''),
  });

  if (!parsed.success) {
    return actionFail('VALIDATION', 'กรุณาตรวจสอบข้อมูลให้ถูกต้อง', fieldErrorsFromZod(parsed.error));
  }

  const data = parsed.data;

  try {
    const result = await getDb().transaction((tx) =>
      adjustToCountedQuantity(tx, {
        productId: data.productId,
        countedQuantity: data.countedQuantity,
        reason: data.reason,
        performedBy: auth.actor.id,
        requestId: data.requestId,
      }),
    );

    if (result.replayed) {
      return actionOk(null, 'รายการนี้ถูกบันทึกไว้แล้ว');
    }

    if (!result.changed) {
      return actionFail('VALIDATION', 'ยอดที่นับได้ตรงกับระบบแล้ว ไม่ต้องปรับยอด', {
        countedQuantity: ['ยอดตรงกับระบบแล้ว'],
      });
    }

    revalidateStockPaths(data.productId);
    return actionOk(
      null,
      `ปรับยอดเป็น ${result.quantityAfter.toLocaleString('th-TH')} สำเร็จ`,
    );
  } catch (error) {
    return handleMovementFailure(
      error,
      { productId: data.productId, requestId: data.requestId, expectedType: 'ADJUSTMENT' },
      'ไม่สามารถปรับยอดได้',
    );
  }
}
