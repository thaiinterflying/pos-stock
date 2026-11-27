import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** ใช้ตัวอักษรตัวแรกของชื่อเป็น avatar แบบย่อ */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return Array.from(trimmed)[0]?.toUpperCase() ?? '?';
}

/**
 * อนุญาตให้ redirect ไปได้เฉพาะ path ภายในแอป
 * ป้องกัน open-redirect เช่น //evil.com หรือ /\evil.com
 */
export function safeInternalPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('\\')) return fallback;
  return value;
}


