const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BANGKOK_OFFSET = '+07:00';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * แปลงวันที่ (YYYY-MM-DD) ตามเวลาไทยเป็น Date แบบ UTC
 * ใช้เป็นขอบเขตเริ่มต้นของช่วงวันที่ใน query
 */
export function parseBangkokDayStart(value: string | null | undefined): Date | null {
  if (!value || !DATE_PATTERN.test(value)) return null;

  const date = new Date(`${value}T00:00:00${BANGKOK_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * ขอบเขตสิ้นสุดแบบ exclusive (ต้นวันถัดไปตามเวลาไทย)
 * ใช้กับเงื่อนไข created_at < เพื่อให้ครอบคลุมทั้งวันโดยไม่ต้องคำนวณ 23:59:59
 */
export function parseBangkokDayEndExclusive(value: string | null | undefined): Date | null {
  const start = parseBangkokDayStart(value);
  if (!start) return null;
  return new Date(start.getTime() + DAY_IN_MS);
}
