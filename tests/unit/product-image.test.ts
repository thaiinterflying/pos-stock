import { describe, expect, it } from 'vitest';

import {
  detectProductImageType,
  normalizeProductImageMime,
  productImageUrl,
  PRODUCT_IMAGE_MAX_BYTES,
} from '../../lib/product-image';
import { parseProductImage } from '../../server/lib/product-image';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function pngFile(size?: number): File {
  if (size && size > PNG_BYTES.length) {
    const bytes = new Uint8Array(size);
    bytes.set(PNG_BYTES);
    return new File([bytes], 'product.png', { type: 'image/png' });
  }
  return new File([PNG_BYTES], 'product.png', { type: 'image/png' });
}

describe('detectProductImageType', () => {
  it('ตรวจ PNG จาก magic bytes', () => {
    expect(detectProductImageType(PNG_BYTES)).toEqual({
      mime: 'image/png',
      extension: 'png',
    });
  });

  it('ตรวจ JPEG จาก magic bytes', () => {
    expect(detectProductImageType(JPEG_BYTES)).toEqual({
      mime: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('ตรวจ WebP จาก magic bytes', () => {
    expect(detectProductImageType(WEBP_BYTES)).toEqual({
      mime: 'image/webp',
      extension: 'webp',
    });
  });

  it('ปฏิเสธไฟล์ที่ไม่ใช่รูปที่รองรับ', () => {
    expect(detectProductImageType(new TextEncoder().encode('hello'))).toBeNull();
    expect(detectProductImageType(new Uint8Array())).toBeNull();
  });
});

describe('normalizeProductImageMime', () => {
  it('แปลง image/jpg และตัวพิมพ์ใหญ่ให้เป็นค่ามาตรฐาน', () => {
    expect(normalizeProductImageMime('image/jpg')).toBe('image/jpeg');
    expect(normalizeProductImageMime('IMAGE/PNG')).toBe('image/png');
    expect(normalizeProductImageMime('application/pdf')).toBeNull();
    expect(normalizeProductImageMime(null)).toBeNull();
  });
});

describe('productImageUrl', () => {
  it('คืน null เมื่อสินค้าไม่มีรูป', () => {
    expect(productImageUrl('id', null)).toBeNull();
  });

  it('ใส่ version จากเวลาเพื่อกัน cache เก่า', () => {
    const url = productImageUrl('abc', new Date('2026-01-02T03:04:05.000Z'));
    expect(url).toBe(`/api/products/abc/image?v=${Date.parse('2026-01-02T03:04:05.000Z')}`);
  });
});

describe('parseProductImage', () => {
  it('ไม่ส่งไฟล์ = ไม่มีรูป', async () => {
    const result = await parseProductImage(new FormData());
    expect(result).toEqual({ ok: true, file: null, remove: false });
  });

  it('รับ PNG ที่ถูกต้อง', async () => {
    const form = new FormData();
    form.set('image', pngFile());

    const result = await parseProductImage(form);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file?.mime).toBe('image/png');
      expect(result.file?.extension).toBe('png');
    }
  });

  it('อ่านค่า removeImage=1 เพื่อลบรูปเดิม', async () => {
    const form = new FormData();
    form.set('removeImage', '1');

    const result = await parseProductImage(form);
    expect(result).toEqual({ ok: true, file: null, remove: true });
  });

  it('ปฏิเสธไฟล์ที่ขนาดเกินกำหนด', async () => {
    const form = new FormData();
    form.set('image', pngFile(PRODUCT_IMAGE_MAX_BYTES + 1));

    const result = await parseProductImage(form);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('2 MB');
  });

  it('ปฏิเสธเมื่อชนิดไฟล์ที่ประกาศไม่ตรงกับเนื้อหา', async () => {
    const form = new FormData();
    form.set('image', new File([PNG_BYTES], 'fake.jpg', { type: 'image/jpeg' }));

    const result = await parseProductImage(form);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('ชนิดไฟล์');
  });

  it('ปฏิเสธไฟล์ข้อความที่ปลอมเป็นรูป', async () => {
    const form = new FormData();
    form.set(
      'image',
      new File([new TextEncoder().encode('not an image')], 'note.png', {
        type: 'image/png',
      }),
    );

    const result = await parseProductImage(form);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('JPG, PNG หรือ WebP');
  });
});
