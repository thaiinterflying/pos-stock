'use client';

import { useActionState } from 'react';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { loginAction } from '@/server/actions/auth.actions';
import type { FormState } from '@/server/lib/result';

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, null);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const showAlert = Boolean(state && !state.ok && !fieldErrors);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      {showAlert && state && !state.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{state.message}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="name@company.co.th"
          required
          disabled={pending}
          aria-invalid={Boolean(fieldErrors?.email)}
        />
        {fieldErrors?.email ? (
          <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="กรอกรหัสผ่าน"
          required
          disabled={pending}
          aria-invalid={Boolean(fieldErrors?.password)}
        />
        {fieldErrors?.password ? (
          <p className="text-xs text-destructive">{fieldErrors.password[0]}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
        {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
      </Button>
    </form>
  );
}
