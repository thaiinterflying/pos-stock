import { and, eq, gte, sql } from 'drizzle-orm';

import type { MovementTypeName } from '@/lib/stock';

import type { DbTransaction } from '../db';
import { products, stockMovements } from '../db/schema';

export type StockErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_MOVEMENT';

export class StockError extends Error {
  readonly code: StockErrorCode;

  constructor(code: StockErrorCode, message: string) {
    super(message);
    this.name = 'StockError';
    this.code = code;
  }
}

export type ApplyMovementInput = {
  productId: string;
  type: MovementTypeName;
  quantityChange: number;
  performedBy: string;
  requestId: string;
  recipientName?: string | null;
  department?: string | null;
  note?: string | null;
};

export type ApplyMovementResult = {
  quantityBefore: number;
  quantityAfter: number;
};

export type AdjustToCountedInput = {
  productId: string;
  countedQuantity: number;
  reason: string;
  performedBy: string;
  requestId: string;
};

export type AdjustToCountedResult = {
  changed: boolean;
  replayed: boolean;
  quantityBefore: number;
  quantityAfter: number;
};

function assertValidMovement(input: ApplyMovementInput): void {
  if (!Number.isInteger(input.quantityChange)) {
    throw new StockError('INVALID_MOVEMENT', 'จำนวนต้องเป็นจำนวนเต็ม');
  }

  if (input.type === 'OUT' && input.quantityChange >= 0) {
    throw new StockError('INVALID_MOVEMENT', 'การเบิกออกต้องมีจำนวนติดลบ');
  }

  if ((input.type === 'IN' || input.type === 'OPENING') && input.quantityChange <= 0) {
    throw new StockError('INVALID_MOVEMENT', 'การรับเข้าต้องมีจำนวนมากกว่า 0');
  }

  if (input.type === 'ADJUSTMENT' && input.quantityChange === 0) {
    throw new StockError('INVALID_MOVEMENT', 'การปรับยอดต้องมีผลต่างไม่เป็นศูนย์');
  }

  if (input.type === 'OUT' && !input.recipientName?.trim()) {
    throw new StockError('INVALID_MOVEMENT', 'ต้องระบุชื่อผู้เบิก');
  }

  if (input.type === 'ADJUSTMENT' && !input.note?.trim()) {
    throw new StockError('INVALID_MOVEMENT', 'ต้องระบุเหตุผลในการปรับยอด');
  }
}

/**
 * อัปเดตสต๊อกและบันทึก Stock Movement ภายใน transaction เดียวกัน
 *
 * ใช้ atomic UPDATE ... WHERE current_stock + delta >= 0 RETURNING
 * เพื่อกัน race condition (อ่าน-แก้-เขียน) และกันสต๊อกติดลบ
 *
 * ต้องเรียกผ่าน db.transaction() เท่านั้น และห้ามแก้ current_stock ที่อื่น
 */
export async function applyMovement(
  tx: DbTransaction,
  input: ApplyMovementInput,
): Promise<ApplyMovementResult> {
  assertValidMovement(input);

  const [updated] = await tx
    .update(products)
    .set({
      currentStock: sql`${products.currentStock} + ${input.quantityChange}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.isActive, true),
        gte(sql`${products.currentStock} + ${input.quantityChange}`, 0),
      ),
    )
    .returning({ currentStock: products.currentStock });

  if (!updated) {
    const [product] = await tx
      .select({
        currentStock: products.currentStock,
        isActive: products.isActive,
      })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (!product) {
      throw new StockError('PRODUCT_NOT_FOUND', 'ไม่พบสินค้านี้');
    }

    if (!product.isActive) {
      throw new StockError('PRODUCT_INACTIVE', 'สินค้านี้ถูกปิดใช้งาน ไม่สามารถเคลื่อนไหวสต๊อกได้');
    }

    throw new StockError(
      'INSUFFICIENT_STOCK',
      `สต๊อกคงเหลือไม่พอ (คงเหลือ ${product.currentStock.toLocaleString('th-TH')})`,
    );
  }

  const quantityAfter = updated.currentStock;
  const quantityBefore = quantityAfter - input.quantityChange;

  await tx.insert(stockMovements).values({
    productId: input.productId,
    type: input.type,
    quantityChange: input.quantityChange,
    quantityBefore,
    quantityAfter,
    recipientName: input.recipientName?.trim() || null,
    department: input.department?.trim() || null,
    note: input.note?.trim() || null,
    performedBy: input.performedBy,
    requestId: input.requestId,
  });

  return { quantityBefore, quantityAfter };
}

/**
 * ปรับยอดให้เท่ากับจำนวนที่นับได้จริง (Admin only)
 *
 * - ล็อกแถวสินค้าด้วย SELECT ... FOR UPDATE เพื่อคำนวณผลต่างได้แม่นยำ
 * - ตรวจ request_id หลังล็อก เพื่อรองรับ double submission แบบ idempotent
 * - ถ้าผลต่างเป็น 0 จะไม่สร้าง movement
 */
export async function adjustToCountedQuantity(
  tx: DbTransaction,
  input: AdjustToCountedInput,
): Promise<AdjustToCountedResult> {
  if (!Number.isInteger(input.countedQuantity) || input.countedQuantity < 0) {
    throw new StockError('INVALID_MOVEMENT', 'จำนวนที่ตรวจนับต้องเป็นจำนวนเต็มและไม่ติดลบ');
  }

  if (!input.reason.trim()) {
    throw new StockError('INVALID_MOVEMENT', 'ต้องระบุเหตุผลในการปรับยอด');
  }

  const [product] = await tx
    .select({ currentStock: products.currentStock, isActive: products.isActive })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1)
    .for('update');

  if (!product) {
    throw new StockError('PRODUCT_NOT_FOUND', 'ไม่พบสินค้านี้');
  }

  if (!product.isActive) {
    throw new StockError('PRODUCT_INACTIVE', 'สินค้านี้ถูกปิดใช้งาน ไม่สามารถเคลื่อนไหวสต๊อกได้');
  }

  // ตรวจหลังได้ lock แถวแล้ว: คำขอเดิมที่ commit ไปแล้วจะมองเห็นได้ ณ จุดนี้
  const [existing] = await tx
    .select({
      productId: stockMovements.productId,
      type: stockMovements.type,
      quantityBefore: stockMovements.quantityBefore,
      quantityAfter: stockMovements.quantityAfter,
    })
    .from(stockMovements)
    .where(eq(stockMovements.requestId, input.requestId))
    .limit(1);

  if (existing) {
    if (existing.productId !== input.productId || existing.type !== 'ADJUSTMENT') {
      throw new StockError('INVALID_MOVEMENT', 'คำขอนี้ถูกใช้งานแล้ว');
    }

    return {
      changed: true,
      replayed: true,
      quantityBefore: existing.quantityBefore,
      quantityAfter: existing.quantityAfter,
    };
  }

  const quantityChange = input.countedQuantity - product.currentStock;

  if (quantityChange === 0) {
    return {
      changed: false,
      replayed: false,
      quantityBefore: product.currentStock,
      quantityAfter: product.currentStock,
    };
  }

  const result = await applyMovement(tx, {
    productId: input.productId,
    type: 'ADJUSTMENT',
    quantityChange,
    note: input.reason,
    performedBy: input.performedBy,
    requestId: input.requestId,
  });

  return {
    changed: true,
    replayed: false,
    quantityBefore: result.quantityBefore,
    quantityAfter: result.quantityAfter,
  };
}
