'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';

import { ProductImageInput } from '@/components/products/product-image-input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { createProductAction, updateProductAction } from '@/server/actions/products.actions';
import type { FormState } from '@/server/lib/result';

type ProductFormCategory = {
  id: string;
  name: string;
  isActive: boolean;
};

type ProductFormProduct = {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  unit: string;
  minStock: number;
  storageLocation: string | null;
  description: string | null;
  currentStock: number;
  imageUrl: string | null;
};

type ProductFormProps = {
  mode: 'create' | 'edit';
  categories: ProductFormCategory[];
  product?: ProductFormProduct;
  /** requestId สำหรับบันทึก ADJUSTMENT จากฟอร์มแก้ไข (กัน double submit) */
  adjustmentRequestId?: string;
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function ProductForm({
  mode,
  categories,
  product,
  adjustmentRequestId,
}: ProductFormProps) {
  const action = mode === 'create' ? createProductAction : updateProductAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const [adjustingStock, setAdjustingStock] = useState(false);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const showAlert = Boolean(state && !state.ok && !fieldErrors);
  const cancelHref = mode === 'edit' && product ? `/products/${product.id}` : '/products';

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {mode === 'edit' && product ? (
        <input type="hidden" name="productId" value={product.id} />
      ) : null}
      {mode === 'edit' && adjustmentRequestId ? (
        <input type="hidden" name="adjustmentRequestId" value={adjustmentRequestId} />
      ) : null}

      {showAlert && state && !state.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{state.message}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลสินค้า</CardTitle>
          <CardDescription>SKU ต้องไม่ซ้ำ และระบบจะแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              name="sku"
              defaultValue={product?.sku}
              placeholder="เช่น A4-001"
              required
              maxLength={32}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.sku)}
              autoComplete="off"
            />
            <FieldError messages={fieldErrors?.sku} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoryId">หมวดหมู่</Label>
            <NativeSelect
              id="categoryId"
              name="categoryId"
              defaultValue={product?.categoryId ?? ''}
              required
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.categoryId)}
            >
              <option value="" disabled>
                เลือกหมวดหมู่
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isActive ? '' : ' (ปิดใช้งาน)'}
                </option>
              ))}
            </NativeSelect>
            <FieldError messages={fieldErrors?.categoryId} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">ชื่อสินค้า</Label>
            <Input
              id="name"
              name="name"
              defaultValue={product?.name}
              placeholder="เช่น กระดาษ A4 80 แกรม"
              required
              maxLength={200}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.name)}
            />
            <FieldError messages={fieldErrors?.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unit">หน่วยนับ</Label>
            <Input
              id="unit"
              name="unit"
              list="unit-suggestions"
              defaultValue={product?.unit}
              placeholder="เช่น ชิ้น, กล่อง, รีม"
              required
              maxLength={50}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.unit)}
              autoComplete="off"
            />
            <datalist id="unit-suggestions">
              <option value="ชิ้น" />
              <option value="กล่อง" />
              <option value="รีม" />
              <option value="แพ็ก" />
              <option value="ชุด" />
              <option value="อัน" />
            </datalist>
            <FieldError messages={fieldErrors?.unit} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="minStock">ยอดขั้นต่ำ (Min Stock)</Label>
            <Input
              id="minStock"
              name="minStock"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={product?.minStock ?? 0}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.minStock)}
            />
            <p className="text-xs text-muted-foreground">
              ใช้คำนวณสถานะ &quot;ใกล้หมด&quot; เมื่อคงเหลือไม่เกินค่านี้
            </p>
            <FieldError messages={fieldErrors?.minStock} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>สต๊อกและที่จัดเก็บ</CardTitle>
          <CardDescription>
            {mode === 'create'
              ? 'ยอดเริ่มต้นจะถูกบันทึกเป็นรายการ "ยอดยกมา" อัตโนมัติ'
              : 'ยอดคงเหลือเปลี่ยนได้ผ่านการรับเข้า เบิกออก หรือการปรับยอดด้านล่าง (ต้องระบุเหตุผล)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {mode === 'create' ? (
            <div className="space-y-1.5">
              <Label htmlFor="openingStock">ยอดเริ่มต้น</Label>
              <Input
                id="openingStock"
                name="openingStock"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                defaultValue={0}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors?.openingStock)}
              />
              <p className="text-xs text-muted-foreground">ใส่ 0 ได้หากยังไม่มีของในสต๊อก</p>
              <FieldError messages={fieldErrors?.openingStock} />
            </div>
          ) : null}

          {mode === 'edit' && product && adjustmentRequestId ? (
            <>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm sm:col-span-2">
                จำนวนคงเหลือปัจจุบัน:{' '}
                <span className="font-semibold tabular-nums">
                  {product.currentStock.toLocaleString('th-TH')} {product.unit}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="countedQuantity">จำนวนที่นับได้จริง</Label>
                <Input
                  id="countedQuantity"
                  name="countedQuantity"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder={`เช่น ${product.currentStock}`}
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors?.countedQuantity)}
                  onChange={(event) => setAdjustingStock(event.target.value.trim() !== '')}
                />
                <p className="text-xs text-muted-foreground">
                  เว้นว่างไว้หากไม่ต้องการปรับยอด
                </p>
                <FieldError messages={fieldErrors?.countedQuantity} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="reason">เหตุผลในการปรับยอด</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  placeholder="เช่น ตรวจนับประจำเดือน พบสินค้าชำรุด"
                  maxLength={300}
                  rows={2}
                  required={adjustingStock}
                  disabled={pending || !adjustingStock}
                  aria-invalid={Boolean(fieldErrors?.reason)}
                />
                <p className="text-xs text-muted-foreground">
                  จำเป็นเมื่อแก้จำนวน — ระบบจะบันทึกเป็นรายการ “ปรับยอด” ในประวัติ
                </p>
                <FieldError messages={fieldErrors?.reason} />
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="storageLocation">ตำแหน่งจัดเก็บ (ไม่บังคับ)</Label>
            <Input
              id="storageLocation"
              name="storageLocation"
              defaultValue={product?.storageLocation ?? ''}
              placeholder="เช่น ชั้น 2 ตู้ A"
              maxLength={100}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.storageLocation)}
            />
            <FieldError messages={fieldErrors?.storageLocation} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รูปสินค้า</CardTitle>
          <CardDescription>
            ใช้รูปเพื่อให้ค้นหาและตรวจสอบสินค้าได้ง่ายขึ้น (1 รูปต่อสินค้า)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductImageInput
            currentImageUrl={product?.imageUrl ?? null}
            disabled={pending}
            error={fieldErrors?.image}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายละเอียดเพิ่มเติม</CardTitle>
          <CardDescription>ข้อมูลเสริมสำหรับช่วยค้นหาและอธิบายสินค้า</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="description">คำอธิบาย (ไม่บังคับ)</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={product?.description ?? ''}
              placeholder="รายละเอียดสินค้า ขนาด หรือหมายเหตุการใช้งาน"
              maxLength={1000}
              rows={3}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors?.description)}
            />
            <FieldError messages={fieldErrors?.description} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <Link href={cancelHref}>ยกเลิก</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
          {mode === 'create' ? 'บันทึกสินค้า' : 'บันทึกการแก้ไข'}
        </Button>
      </div>
    </form>
  );
}
