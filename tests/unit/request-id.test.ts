import { describe, expect, it } from 'vitest';

import { createRequestId } from '../../lib/request-id';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createRequestId', () => {
  it('สร้าง UUID v4 ที่ถูกต้อง', () => {
    expect(createRequestId()).toMatch(UUID_V4);
  });

  it('ไม่สร้างค่าซ้ำกัน', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createRequestId()));
    expect(ids.size).toBe(100);
  });
});
