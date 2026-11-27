import type { ZodError } from 'zod';

export type ActionErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_STOCK'
  | 'INTERNAL';

export type ActionFailure = {
  ok: false;
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionSuccess<T> = {
  ok: true;
  data: T;
  message?: string;
};

export type ActionResult<T = null> = ActionSuccess<T> | ActionFailure;

/** state ที่ใช้กับ useActionState ฝั่ง client */
export type FormState<T = null> = ActionResult<T> | null;

export function actionOk<T = null>(data: T, message?: string): ActionSuccess<T> {
  return { ok: true, data, message };
}

export function actionFail(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionFailure {
  return fieldErrors ? { ok: false, code, message, fieldErrors } : { ok: false, code, message };
}

export function fieldErrorsFromZod(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}
