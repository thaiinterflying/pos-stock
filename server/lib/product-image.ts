import { randomUUID } from 'node:crypto';

import {
  detectProductImageType,
  normalizeProductImageMime,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_LABEL,
  type DetectedProductImage,
} from '@/lib/product-image';

export type ProductImageUpload = DetectedProductImage & {
  bytes: Uint8Array;
};

export type ParsedProductImage =
  | { ok: true; file: ProductImageUpload | null; remove: boolean }
  | { ok: false; message: string };

export function buildProductImageKey(extension: string): string {
  return `products/${randomUUID()}.${extension}`;
}

/**
 * อ่านไฟล์รูปจาก FormData แล้วตรวจขนาด/ชนิดจากเนื้อหาจริง
 * - ไม่ส่งไฟล์ = ไม่เปลี่ยนแปลงรูปเดิม
 * - `removeImage=1` = ลบรูปเดิม (ยกเว้นมีไฟล์ใหม่ส่งมาด้วย)
 */
export async function parseProductImage(formData: FormData): Promise<ParsedProductImage> {
  const remove = formData.get('removeImage') === '1';
  const entry = formData.get('image');

  if (!entry || typeof entry === 'string') {
    return { ok: true, file: null, remove };
  }

  if (typeof File !== 'undefined' && !(entry instanceof File)) {
    return { ok: false, message: 'ไฟล์รูปภาพไม่ถูกต้อง' };
  }

  if (entry.size === 0) {
    return { ok: true, file: null, remove };
  }

  if (entry.size > PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, message: `รูปภาพต้องมีขนาดไม่เกิน ${PRODUCT_IMAGE_MAX_LABEL}` };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await entry.arrayBuffer());
  } catch {
    return { ok: false, message: 'อ่านไฟล์รูปภาพไม่สำเร็จ กรุณาเลือกไฟล์ใหม่' };
  }

  const detected = detectProductImageType(bytes);
  if (!detected) {
    return { ok: false, message: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP' };
  }

  const declared = normalizeProductImageMime(entry.type || null);
  if (declared && declared !== detected.mime) {
    return { ok: false, message: 'ชนิดไฟล์ไม่ตรงกับเนื้อหาของรูปภาพ' };
  }

  return {
    ok: true,
    file: { ...detected, bytes },
    remove: false,
  };
}
