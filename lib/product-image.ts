/** ค่าคงที่และ helper ที่ใช้ได้ทั้งฝั่ง client และ server (ไม่พึ่ง Node API) */

export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_LABEL = '2 MB';
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

export type ProductImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export type ProductImageExtension = 'jpg' | 'png' | 'webp';

export type DetectedProductImage = {
  mime: ProductImageMime;
  extension: ProductImageExtension;
};

const MIME_ALIASES: Record<string, ProductImageMime> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

/** แปลง MIME ที่ browser ส่งมา (อาจเป็น image/jpg หรือค่าว่าง) ให้เป็นค่ามาตรฐาน */
export function normalizeProductImageMime(
  value: string | null | undefined,
): ProductImageMime | null {
  if (!value) return null;
  return MIME_ALIASES[value.toLowerCase()] ?? null;
}

/** ตรวจชนิดไฟล์จาก magic bytes — ไม่เชื่อ Content-Type ที่ client ส่งมา */
export function detectProductImageType(bytes: Uint8Array): DetectedProductImage | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', extension: 'png' };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }

  return null;
}

/**
 * URL สำหรับแสดงรูป พร้อม version จาก image_updated_at
 * เพื่อให้เปลี่ยนรูปแล้ว browser ไม่ใช้ cache เก่า
 */
export function productImageUrl(
  productId: string,
  imageUpdatedAt: Date | string | null | undefined,
): string | null {
  if (!imageUpdatedAt) return null;

  const time =
    imageUpdatedAt instanceof Date ? imageUpdatedAt.getTime() : Date.parse(imageUpdatedAt);

  return `/api/products/${productId}/image?v=${Number.isFinite(time) ? time : 0}`;
}
