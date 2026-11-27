import { describe, expect, it } from 'vitest';

import { generateSessionToken, hashSessionToken } from '../../server/auth/tokens';

describe('session tokens', () => {
  it('สร้าง token ที่ไม่ซ้ำและมีความยาวเพียงพอ', () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it('hash token ได้ผลลัพธ์คงที่และไม่เปิดเผย token เดิม', () => {
    const token = 'example-session-token';
    const hash = hashSessionToken(token);

    expect(hash).toBe(hashSessionToken(token));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
  });
});
