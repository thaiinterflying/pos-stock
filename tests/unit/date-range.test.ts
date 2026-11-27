import { describe, expect, it } from 'vitest';

import { parseBangkokDayEndExclusive, parseBangkokDayStart } from '../../lib/date-range';

describe('parseBangkokDayStart', () => {
  it('แปลงต้นวันตามเวลาไทยเป็น UTC ได้ถูกต้อง', () => {
    expect(parseBangkokDayStart('2026-01-15')?.toISOString()).toBe(
      '2026-01-14T17:00:00.000Z',
    );
  });

  it('คืน null เมื่อรูปแบบไม่ถูกต้องหรือว่าง', () => {
    expect(parseBangkokDayStart('')).toBeNull();
    expect(parseBangkokDayStart(null)).toBeNull();
    expect(parseBangkokDayStart('15/01/2026')).toBeNull();
    expect(parseBangkokDayStart('2026-13-01')).toBeNull();
  });
});

describe('parseBangkokDayEndExclusive', () => {
  it('คืนต้นวันถัดไปแบบ exclusive', () => {
    expect(parseBangkokDayEndExclusive('2026-01-15')?.toISOString()).toBe(
      '2026-01-15T17:00:00.000Z',
    );
  });

  it('คืน null เมื่อรูปแบบไม่ถูกต้อง', () => {
    expect(parseBangkokDayEndExclusive('not-a-date')).toBeNull();
  });
});
