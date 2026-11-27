'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2Icon,
  SparklesIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PasswordInput } from '@/components/ui/password-input';
import { generateRandomPassword } from '@/lib/password';
import type { UserSummary } from '@/lib/types';
import {
  createUserAction,
  resetPasswordAction,
  updateUserAction,
} from '@/server/actions/users.actions';
import type { FormState } from '@/server/lib/result';

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

/**
 * ใช้ state จาก useActionState เพื่อแสดง toast + ปิด dialog
 * ตั้งใจไม่ใส่ router/onClose ใน dependency เพื่อไม่ให้ effect ทำงานซ้ำเมื่อ parent re-render
 */
function useUserFormFeedback(state: FormState, onSuccess: () => void) {
  const router = useRouter();

  React.useEffect(() => {
    if (!state) return;

    if (state.ok) {
      toast.success(state.message ?? 'บันทึกข้อมูลเรียบร้อยแล้ว');
      router.refresh();
      onSuccess();
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
}

type DialogBaseProps = {
  onClose: () => void;
};

export function CreateUserDialog({ onClose }: DialogBaseProps) {
  const [state, formAction, pending] = useActionStateSafe();
  useUserFormFeedback(state, onClose);

  const [password, setPassword] = React.useState('');
  const [generated, setGenerated] = React.useState<string | null>(null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  function handleGenerate() {
    const value = generateRandomPassword(12);
    setPassword(value);
    setGenerated(value);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เพิ่มผู้ใช้</DialogTitle>
          <DialogDescription>
            สร้างบัญชีสำหรับผู้ดูแลระบบหรือพนักงาน ระบบไม่มี public registration
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="create-name">ชื่อ-นามสกุล</Label>
            <Input
              id="create-name"
              name="name"
              required
              maxLength={100}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.name)}
            />
            <FieldError messages={fieldErrors?.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-email">อีเมล</Label>
            <Input
              id="create-email"
              name="email"
              type="email"
              autoComplete="off"
              placeholder="name@company.co.th"
              required
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.email)}
            />
            <FieldError messages={fieldErrors?.email} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-role">บทบาท</Label>
            <NativeSelect
              id="create-role"
              name="role"
              defaultValue="STAFF"
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.role)}
            >
              <option value="STAFF">พนักงาน</option>
              <option value="ADMIN">ผู้ดูแลระบบ</option>
            </NativeSelect>
            <FieldError messages={fieldErrors?.role} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="create-password">รหัสผ่านเริ่มต้น</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                onClick={handleGenerate}
                disabled={pending}
              >
                <SparklesIcon className="size-3.5" aria-hidden="true" />
                สุ่มรหัสผ่าน
              </Button>
            </div>
            <PasswordInput
              id="create-password"
              name="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setGenerated(null);
              }}
              autoComplete="new-password"
              required
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.password)}
            />
            {generated ? (
              <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs">
                รหัสผ่านที่สุ่มได้: <span className="font-semibold">{generated}</span> —
                กรุณาบันทึกไว้ก่อนกดบันทึก
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              อย่างน้อย 10 ตัวอักษร และต้องมีทั้งตัวอักษรและตัวเลข
            </p>
            <FieldError messages={fieldErrors?.password} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditUserDialog({
  user,
  isSelf,
  onClose,
}: DialogBaseProps & { user: UserSummary; isSelf: boolean }) {
  const [state, formAction, pending] = useActionStateSafeUpdate();
  useUserFormFeedback(state, onClose);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
          <DialogDescription>
            แก้ไขชื่อและบทบาทผู้ใช้ บัญชีที่ถูกปิดใช้งานจะออกจากระบบทันที
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="userId" value={user.id} />

          <div className="space-y-1.5">
            <Label htmlFor="edit-name">ชื่อ-นามสกุล</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={user.name}
              required
              maxLength={100}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.name)}
            />
            <FieldError messages={fieldErrors?.name} />
          </div>

          <div className="space-y-1.5">
            <Label>อีเมล</Label>
            <Input value={user.email} readOnly disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">อีเมลใช้เป็นชื่อผู้ใช้และไม่สามารถแก้ไขได้</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-role">บทบาท</Label>
            <NativeSelect
              id="edit-role"
              name={isSelf ? undefined : 'role'}
              defaultValue={user.role}
              disabled={pending || isSelf}
            >
              <option value="STAFF">พนักงาน</option>
              <option value="ADMIN">ผู้ดูแลระบบ</option>
            </NativeSelect>
            {isSelf ? <input type="hidden" name="role" value={user.role} /> : null}
            {isSelf ? (
              <p className="text-xs text-muted-foreground">
                ไม่สามารถเปลี่ยนบทบาทของบัญชีตัวเองได้
              </p>
            ) : null}
            <FieldError messages={fieldErrors?.role} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResetPasswordDialog({
  user,
  isSelf,
  onClose,
}: DialogBaseProps & { user: UserSummary; isSelf: boolean }) {
  const [state, formAction, pending] = useActionStateSafeReset();
  useUserFormFeedback(state, onClose);

  const [password, setPassword] = React.useState('');
  const [generated, setGenerated] = React.useState<string | null>(null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  const [copied, setCopied] = React.useState(false);

  function handleGenerate() {
    const value = generateRandomPassword(12);
    setPassword(value);
    setGenerated(value);
    setCopied(false);
  }

  async function handleCopy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      toast.success('คัดลอกรหัสผ่านแล้ว');
    } catch {
      toast.error('คัดลอกไม่สำเร็จ กรุณาจดรหัสผ่านด้วยตนเอง');
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>รีเซ็ตรหัสผ่าน</DialogTitle>
          <DialogDescription>
            ตั้งรหัสผ่านใหม่ให้ {user.name} และออกจากระบบทุกอุปกรณ์
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="userId" value={user.id} />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="reset-password">รหัสผ่านใหม่</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                onClick={handleGenerate}
                disabled={pending}
              >
                <SparklesIcon className="size-3.5" aria-hidden="true" />
                สุ่มรหัสผ่าน
              </Button>
            </div>
            <PasswordInput
              id="reset-password"
              name="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setGenerated(null);
              }}
              autoComplete="new-password"
              required
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.password)}
            />
            {generated ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                <span>
                  รหัสผ่านใหม่: <span className="font-semibold">{generated}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleCopy}
                >
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              อย่างน้อย 10 ตัวอักษร และต้องมีทั้งตัวอักษรและตัวเลข
            </p>
            <FieldError messages={fieldErrors?.password} />
          </div>

          {isSelf ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              คุณกำลังรีเซ็ตรหัสผ่านของบัญชีตัวเอง ระบบจะออกจากระบบทันทีหลังบันทึก
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
              รีเซ็ตรหัสผ่าน
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// hooks แยกเพื่อให้ type ของ useActionState ชัดเจนและไม่ต้องเขียนซ้ำ
function useActionStateSafe() {
  return React.useActionState<FormState, FormData>(createUserAction, null);
}

function useActionStateSafeUpdate() {
  return React.useActionState<FormState, FormData>(updateUserAction, null);
}

function useActionStateSafeReset() {
  return React.useActionState<FormState, FormData>(resetPasswordAction, null);
}
