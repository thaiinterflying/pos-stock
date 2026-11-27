export const APP_NAME = 'TIF Stock';
export const APP_COMPANY = 'Thai Inter Flying';
export const APP_DESCRIPTION = 'ระบบจัดการสต๊อกอุปกรณ์สำนักงาน';

export const SESSION_COOKIE_NAME = 'tif_session';
export const SESSION_TTL_HOURS = 8;

export const DISPLAY_TIME_ZONE = 'Asia/Bangkok';

export const PASSWORD_MIN_LENGTH = 10;

export type AppRole = 'ADMIN' | 'STAFF';

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  STAFF: 'พนักงาน',
};
