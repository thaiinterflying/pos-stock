import { describe, expect, it } from 'vitest';

import { generateRandomPassword } from '../../lib/password';
import { getInitials, safeInternalPath } from '../../lib/utils';

describe('safeInternalPath', () => {
  it('อนุญาต path ภายในแอป', () => {
    expect(safeInternalPath('/products')).toBe('/products');
    expect(safeInternalPath('/settings/users')).toBe('/settings/users');
  });

  it('บล็อก open redirect', () => {
    expect(safeInternalPath('//evil.example.com')).toBe('/dashboard');
    expect(safeInternalPath('https://evil.example.com')).toBe('/dashboard');
    expect(safeInternalPath('/\\evil.example.com')).toBe('/dashboard');
    expect(safeInternalPath(null)).toBe('/dashboard');
  });
});

describe('getInitials', () => {
  it('คืนค่าตัวอักษรแรกของชื่อ', () => {
    expect(getInitials('สมชาย')).toBe('ส');
    expect(getInitials('  ann ')).toBe('A');
    expect(getInitials('')).toBe('?');
  });
});

describe('generateRandomPassword', () => {
  it('ผ่านนโยบายรหัสผ่านทุกครั้ง', () => {
    for (let index = 0; index < 50; index += 1) {
      const password = generateRandomPassword(12);
      expect(password).toHaveLength(12);
      expect(password).toMatch(/[A-Za-z]/);
      expect(password).toMatch(/[0-9]/);
    }
  });

  it('ไม่สร้างรหัสซ้ำกัน', () => {
    const passwords = new Set(
      Array.from({ length: 50 }, () => generateRandomPassword(12)),
    );
    expect(passwords.size).toBe(50);
  });
});
