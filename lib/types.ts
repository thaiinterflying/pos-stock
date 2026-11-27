import type { AppRole } from './constants';

/** ข้อมูลผู้ใช้ที่ส่งข้ามฝั่ง server → client ได้ (ไม่รวมข้อมูลอ่อนไหว) */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export type UserSummary = CurrentUser & {
  isActive: boolean;
  createdAt: Date;
};
