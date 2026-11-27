const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*';

function randomInt(max: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) % max;
}

function pick(source: string): string {
  return source[randomInt(source.length)] ?? '';
}

/**
 * สุ่มรหัสผ่านที่ผ่านนโยบายขั้นต่ำเสมอ
 * (มีตัวอักษร ตัวเลข และอักขระพิเศษอย่างละอย่างน้อย 1 ตัว)
 */
export function generateRandomPassword(length = 12): string {
  if (length < 4) throw new Error('ความยาวรหัสผ่านต้องมากกว่า 3 ตัวอักษร');

  const chars = [pick(LETTERS), pick(DIGITS), pick(SYMBOLS)];
  const pool = LETTERS + DIGITS + SYMBOLS;

  while (chars.length < length) {
    chars.push(pick(pool));
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const a = chars[i]!;
    const b = chars[j]!;
    chars[i] = b;
    chars[j] = a;
  }

  return chars.join('');
}
