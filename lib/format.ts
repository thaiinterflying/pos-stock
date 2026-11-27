import { DISPLAY_TIME_ZONE } from './constants';

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'long',
  timeZone: DISPLAY_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: DISPLAY_TIME_ZONE,
});

const hourFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: DISPLAY_TIME_ZONE,
});

/** แสดงวันที่ตามเขตเวลา Asia/Bangkok (ค่าใน DB เป็น UTC) */
export function formatDate(value: Date | string | number): string {
  return dateFormatter.format(new Date(value));
}

/** แสดงวันที่และเวลาตามเขตเวลา Asia/Bangkok */
export function formatDateTime(value: Date | string | number): string {
  return dateTimeFormatter.format(new Date(value));
}

/** ชั่วโมงปัจจุบัน (0–23) ตามเวลาไทย ใช้เลือกคำทักทาย */
export function getBangkokHour(date: Date = new Date()): number {
  return Number(hourFormatter.format(date));
}

export function getGreeting(date: Date = new Date()): string {
  const hour = getBangkokHour(date);
  if (hour < 12) return 'สวัสดีตอนเช้า';
  if (hour < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

const csvDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** รูปแบบ YYYY-MM-DD HH:mm:ss ตามเวลาไทย สำหรับใช้ใน CSV (เรียงลำดับได้ใน Excel) */
export function formatDateTimeForCsv(value: Date | string | number): string {
  const parts = csvDateTimeFormatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
}

/** ใช้ตั้งชื่อไฟล์ เช่น 20260115-103005 (เวลาไทย) */
export function formatBangkokFilenameStamp(date: Date = new Date()): string {
  return formatDateTimeForCsv(date).replace(/[-:]/g, '').replace(' ', '-');
}
