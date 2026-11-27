'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircleIcon, ArrowRightIcon, Loader2Icon } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { createRequestId } from '@/lib/request-id';
import { formatSignedQuantity } from '@/lib/stock';
import { cn } from '@/lib/utils';
import {
  adjustStockAction,
  stockInAction,
  stockOutAction,
} from '@/server/actions/stock.actions';
import type { FormState } from '@/server/lib/result';

import type { StockActionProduct, StockMovementMode } from './types';

type StockMovementDialogProps = {
  mode: StockMovementMode;
  product: StockActionProduct;
  onClose: () => void;
};

const COPY: Record<
  StockMovementMode,
  { title: string; description: string; submitLabel: string }
> = {
  IN: {
    title: 'รับสินค้าเข้า',
    description: 'ระบุจำนวนที่รับเข้ามาใหม่ ระบบจะบันทึกประวัติพร้อมผู้ดำเนินการให้อัตโนมัติ',
    submitLabel: 'ยืนยันรับเข้า',
  },
  OUT: {
    title: 'เบิกสินค้าออก',
    description: 'ระบุจำนวนและชื่อผู้เบิก ระบบจะป้องกันการเบิกเกินยอดคงเหลือ',
    submitLabel: 'ยืนยันเบิกออก',
  },
  ADJUST: {
    title: 'ปรับยอดสต๊อก',
    description: 'สำหรับผู้ดูแลระบบ — ระบุจำนวนที่ตรวจนับได้จริงและเหตุผลในการปรับ',
    submitLabel: 'ยืนยันปรับยอด',
  },
};

function parseInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function StockMovementDialog({ mode, product, onClose }: StockMovementDialogProps) {
  const router = useRouter();
  const [requestId] = React.useState(() => createRequestId());

  const [quantity, setQuantity] = React.useState('1');
  const [recipientName, setRecipientName] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [note, setNote] = React.useState('');
  const [countedQuantity, setCountedQuantity] = React.useState(String(product.currentStock));
  const [reason, setReason] = React.useState('');

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    mode === 'IN' ? stockInAction : mode === 'OUT' ? stockOutAction : adjustStockAction,
    null,
  );

  React.useEffect(() => {
    if (!state) return;

    if (state.ok) {
      toast.success(state.message ?? 'บันทึกการเคลื่อนไหวเรียบร้อยแล้ว');
      router.refresh();
      onClose();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const showAlert = Boolean(state && !state.ok && !fieldErrors);

  const parsedQuantity = parseInteger(quantity);
  const parsedCounted = parseInteger(countedQuantity);

  const quantityForPreview =
    mode === 'ADJUST' ? (parsedCounted ?? product.currentStock) : (parsedQuantity ?? 0);
  const delta =
    mode === 'IN'
      ? quantityForPreview
      : mode === 'OUT'
        ? -quantityForPreview
        : quantityForPreview - product.currentStock;
  const previewAfter = product.currentStock + delta;

  const isOutTooMany =
    mode === 'OUT' && parsedQuantity !== null && parsedQuantity > product.currentStock;
  const isAdjustNoChange =
    mode === 'ADJUST' && parsedCounted !== null && parsedCounted === product.currentStock;

  const showPreview =
    mode === 'ADJUST'
      ? parsedCounted !== null && parsedCounted >= 0
      : parsedQuantity !== null &&
        parsedQuantity > 0 &&
        !(mode === 'OUT' && isOutTooMany);

  const isValid =
    mode === 'IN'
      ? parsedQuantity !== null && parsedQuantity > 0
      : mode === 'OUT'
        ? parsedQuantity !== null &&
          parsedQuantity > 0 &&
          !isOutTooMany &&
          recipientName.trim().length > 0
        : parsedCounted !== null &&
          parsedCounted >= 0 &&
          reason.trim().length >= 3 &&
          !isAdjustNoChange;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{COPY[mode].title}</DialogTitle>
          <DialogDescription>
            {COPY[mode].description}
            <span className="mt-1 block text-xs text-muted-foreground">
              {product.name} · SKU {product.sku}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="requestId" value={requestId} />

          {showAlert && state && !state.ok ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{state.message}</p>
            </div>
          ) : null}

          {mode === 'ADJUST' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="countedQuantity">จำนวนที่ตรวจนับได้จริง</Label>
                <Input
                  id="countedQuantity"
                  name="countedQuantity"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={countedQuantity}
                  onChange={(event) => setCountedQuantity(event.target.value)}
                  disabled={pending}
                  autoFocus
                  aria-invalid={Boolean(fieldErrors?.countedQuantity)}
                />
                <p className="text-xs text-muted-foreground">
                  ยอดในระบบ {product.currentStock.toLocaleString('th-TH')} {product.unit}
                </p>
                <FieldError messages={fieldErrors?.countedQuantity} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">เหตุผลในการปรับยอด</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="เช่น ตรวจนับประจำเดือน พบของชำรุด 2 ชิ้น"
                  rows={3}
                  maxLength={300}
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors?.reason)}
                />
                <FieldError messages={fieldErrors?.reason} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="quantity">
                  {mode === 'IN' ? 'จำนวนที่รับเข้า' : 'จำนวนที่เบิก'}
                </Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={pending}
                  autoFocus
                  aria-invalid={Boolean(fieldErrors?.quantity)}
                />
                <p className="text-xs text-muted-foreground">
                  หน่วยนับ: {product.unit} · คงเหลือ{' '}
                  {product.currentStock.toLocaleString('th-TH')} {product.unit}
                </p>
                <FieldError messages={fieldErrors?.quantity} />
                {isOutTooMany ? (
                  <p className="text-xs text-destructive">
                    จำนวนที่เบิกเกินยอดคงเหลือ ({product.currentStock.toLocaleString('th-TH')}{' '}
                    {product.unit})
                  </p>
                ) : null}
              </div>

              {mode === 'OUT' ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="recipientName">
                      ชื่อผู้เบิก <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="recipientName"
                      name="recipientName"
                      value={recipientName}
                      onChange={(event) => setRecipientName(event.target.value)}
                      placeholder="เช่น สมชาย ใจดี"
                      required
                      maxLength={100}
                      disabled={pending}
                      aria-invalid={Boolean(fieldErrors?.recipientName)}
                    />
                    <FieldError messages={fieldErrors?.recipientName} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="department">แผนก (ไม่บังคับ)</Label>
                    <Input
                      id="department"
                      name="department"
                      value={department}
                      onChange={(event) => setDepartment(event.target.value)}
                      placeholder="เช่น บัญชี, ฝ่ายขาย"
                      maxLength={100}
                      disabled={pending}
                      aria-invalid={Boolean(fieldErrors?.department)}
                    />
                    <FieldError messages={fieldErrors?.department} />
                  </div>
                </>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="note">หมายเหตุ (ไม่บังคับ)</Label>
                <Input
                  id="note"
                  name="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="รายละเอียดเพิ่มเติม"
                  maxLength={300}
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors?.note)}
                />
                <FieldError messages={fieldErrors?.note} />
              </div>
            </>
          )}

          {showPreview ? (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {mode === 'ADJUST' ? 'ยอดคงเหลือจะเปลี่ยนจาก' : 'คงเหลือ'}
              </p>
              <div className="flex items-center gap-2 text-lg font-semibold tabular-nums">
                <span>{product.currentStock.toLocaleString('th-TH')}</span>
                <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span
                  className={cn(
                    previewAfter <= 0
                      ? 'text-red-600'
                      : previewAfter <= product.minStock
                        ? 'text-amber-600'
                        : 'text-emerald-600',
                  )}
                >
                  {previewAfter.toLocaleString('th-TH')}
                </span>
                <span className="text-xs font-normal text-muted-foreground">{product.unit}</span>
              </div>

              {mode === 'ADJUST' && delta !== 0 ? (
                <p className="text-xs text-muted-foreground">
                  ผลต่าง {formatSignedQuantity(delta)} {product.unit}
                </p>
              ) : null}

              {mode === 'ADJUST' && isAdjustNoChange ? (
                <p className="text-xs text-muted-foreground">
                  ยอดตรงกับระบบแล้ว ไม่ต้องปรับยอด
                </p>
              ) : null}

              {mode === 'OUT' && !isOutTooMany && previewAfter <= product.minStock ? (
                <p className="text-xs text-amber-700">
                  หลังเบิกจะอยู่ในเกณฑ์ {previewAfter === 0 ? 'หมดสต๊อก' : 'ใกล้หมด'}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending || !isValid}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
              {COPY[mode].submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
