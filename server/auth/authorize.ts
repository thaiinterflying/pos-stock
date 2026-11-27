import type { CurrentUser } from '@/lib/types';

import { actionFail, type ActionFailure } from '@/server/lib/result';

import { getCurrentUser } from './session';

export type ActionAuthorization =
  | { ok: true; actor: CurrentUser }
  | { ok: false; failure: ActionFailure };

function unauthenticated(): ActionFailure {
  return actionFail('UNAUTHENTICATED', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
}

/** ตรวจว่าผู้ใช้ login อยู่หรือไม่ (ใช้กับ action ที่ทั้ง Admin และ Staff ทำได้) */
export async function authorizeActionUser(): Promise<ActionAuthorization> {
  const actor = await getCurrentUser();

  if (!actor) {
    return { ok: false, failure: unauthenticated() };
  }

  return { ok: true, actor };
}

/** ตรวจสิทธิ์ใน Server Action — ต้องทำฝั่ง server ทุกครั้ง ไม่พึ่ง UI */
export async function authorizeActionAdmin(): Promise<ActionAuthorization> {
  const auth = await authorizeActionUser();
  if (!auth.ok) return auth;

  if (auth.actor.role !== 'ADMIN') {
    return { ok: false, failure: actionFail('FORBIDDEN', 'เฉพาะผู้ดูแลระบบเท่านั้น') };
  }

  return auth;
}
