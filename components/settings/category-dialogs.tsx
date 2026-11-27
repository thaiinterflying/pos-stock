'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
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
import {
  createCategoryAction,
  updateCategoryAction,
} from '@/server/actions/categories.actions';
import type { FormState } from '@/server/lib/result';

type CategoryFormDialogProps = {
  category?: { id: string; name: string };
  onClose: () => void;
};

export function CategoryFormDialog({ category, onClose }: CategoryFormDialogProps) {
  const router = useRouter();
  const action = category ? updateCategoryAction : createCategoryAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  useEffect(() => {
    if (!state) return;

    if (state.ok) {
      toast.success(state.message ?? 'บันทึกหมวดหมู่เรียบร้อยแล้ว');
      router.refresh();
      onClose();
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</DialogTitle>
          <DialogDescription>
            หมวดหมู่ช่วยจัดกลุ่มสินค้าและใช้เป็นตัวกรองในรายการสินค้า
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          {category ? <input type="hidden" name="categoryId" value={category.id} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="category-name">ชื่อหมวดหมู่</Label>
            <Input
              id="category-name"
              name="name"
              defaultValue={category?.name}
              placeholder="เช่น เครื่องเขียน, อุปกรณ์ไอที"
              required
              maxLength={60}
              autoFocus
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.name)}
            />
            {fieldErrors?.name ? (
              <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
            ) : null}
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
