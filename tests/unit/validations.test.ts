import { describe, expect, it } from 'vitest';

import { loginSchema } from '../../validations/auth';
import { createUserSchema } from '../../validations/user';

describe('loginSchema', () => {
  it('แปลงอีเมลเป็นตัวพิมพ์เล็กและตัดช่องว่าง', () => {
    const result = loginSchema.safeParse({
      email: '  Admin@TIF.co.th ',
      password: 'secret',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('admin@tif.co.th');
    }
  });

  it('ปฏิเสธอีเมลไม่ถูกต้องและรหัสผ่านว่าง', () => {
    const invalidEmail = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
    expect(invalidEmail.success).toBe(false);

    const emptyPassword = loginSchema.safeParse({
      email: 'admin@tif.co.th',
      password: '',
    });
    expect(emptyPassword.success).toBe(false);
  });
});

describe('createUserSchema', () => {
  const base = {
    name: 'สมชาย ใจดี',
    email: 'somchai@tif.co.th',
    role: 'STAFF' as const,
  };

  it('ยอมรับข้อมูลที่ถูกต้อง', () => {
    const result = createUserSchema.safeParse({ ...base, password: 'Password12' });
    expect(result.success).toBe(true);
  });

  it('ปฏิเสธรหัสผ่านสั้นกว่า 10 ตัวอักษร', () => {
    const result = createUserSchema.safeParse({ ...base, password: 'Pass1' });
    expect(result.success).toBe(false);
  });

  it('ปฏิเสธรหัสผ่านที่ไม่มีตัวเลข', () => {
    const result = createUserSchema.safeParse({ ...base, password: 'PasswordOnly' });
    expect(result.success).toBe(false);
  });

  it('ปฏิเสธบทบาทที่ไม่รู้จัก', () => {
    const result = createUserSchema.safeParse({
      ...base,
      role: 'OWNER',
      password: 'Password12',
    });
    expect(result.success).toBe(false);
  });
});
