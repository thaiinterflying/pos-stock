import { describe, expect, it } from 'vitest';

import { formatBangkokFilenameStamp, formatDateTimeForCsv } from '../../lib/format';

describe('formatDateTimeForCsv', () => {
  it('แปลง UTC เป็นเวลาไทยในรูปแบบที่ Excel เรียงลำดับได้', () => {
    expect(formatDateTimeForCsv('2026-01-15T03:30:05Z')).toBe('2026-01-15 10:30:05');
  });

  it('ข้ามวันตามเขตเวลาไทยได้ถูกต้อง', () => {
    expect(formatDateTimeForCsv('2026-01-15T20:00:00Z')).toBe('2026-01-16 03:00:00');
  });
});

describe('formatBangkokFilenameStamp', () => {
  it('สร้างชื่อไฟล์แบบ YYYYMMDD-HHmmss ตามเวลาไทย', () => {
    expect(formatBangkokFilenameStamp(new Date('2026-01-15T03:30:05Z'))).toBe(
      '20260115-103005',
    );
  });
});
