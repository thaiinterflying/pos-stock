import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon, PencilIcon } from 'lucide-react';

import { ProductActiveToggle } from '@/components/products/product-active-toggle';
import { ProductMovements } from '@/components/products/product-movements';
import { StockStatusBadge } from '@/components/products/stock-status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { StockActionButtons } from '@/components/stock/stock-action-buttons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import { productImageUrl } from '@/lib/product-image';
import { getStockStatus } from '@/lib/stock';
import { requireUser } from '@/server/auth/guard';
import { findProductById, listProductMovements } from '@/server/queries/products';

export const metadata: Metadata = {
  title: 'รายละเอียดสินค้า',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [actor, { id }, query] = await Promise.all([requireUser(), params, searchParams]);
  const [product, movements] = await Promise.all([
    findProductById(id),
    listProductMovements(id),
  ]);

  if (!product) {
    notFound();
  }

  const status = getStockStatus(product.currentStock, product.minStock);
  const canManage = actor.role === 'ADMIN';
  const imageUrl = productImageUrl(product.id, product.imageUpdatedAt);
  const justCreated = firstParam(query.created) === '1';
  const justUpdated = firstParam(query.updated) === '1';
  const justAdjusted = firstParam(query.adjusted) === '1';

  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        กลับไปรายการสินค้า
      </Link>

      <PageHeader
        title={product.name}
        description={`SKU ${product.sku} · ${product.categoryName}`}
      >
        <StockStatusBadge status={status} />
        {!product.isActive ? <Badge variant="outline">ปิดใช้งาน</Badge> : null}
        <StockActionButtons
          product={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            currentStock: product.currentStock,
            minStock: product.minStock,
            isActive: product.isActive,
          }}
          canAdjust={canManage}
        />
        {canManage ? (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/products/${product.id}/edit`}>
                <PencilIcon aria-hidden="true" />
                แก้ไข
              </Link>
            </Button>
            <ProductActiveToggle
              productId={product.id}
              productName={product.name}
              isActive={product.isActive}
            />
          </>
        ) : null}
      </PageHeader>

      {justCreated ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          เพิ่มสินค้าเรียบร้อยแล้ว
          {movements.length > 0 ? ' และบันทึกยอดยกมาเป็นประวัติการเคลื่อนไหวให้แล้ว' : ''}
        </div>
      ) : null}

      {justUpdated ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {justAdjusted
            ? 'บันทึกการแก้ไขและปรับจำนวนคงเหลือเรียบร้อยแล้ว ระบบได้บันทึกประวัติการปรับยอดให้แล้ว'
            : 'บันทึกการแก้ไขสินค้าเรียบร้อยแล้ว'}
        </div>
      ) : null}

      {!product.isActive ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          สินค้านี้ถูกปิดใช้งาน จะไม่แสดงในรายการปกติและไม่สามารถรับเข้า/เบิกออกได้
          แต่ประวัติและยอดคงเหลือยังอยู่ครบ
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>ข้อมูลสินค้า</CardTitle>
          </CardHeader>
          <CardContent>
            {imageUrl ? (
              <div className="mb-4 overflow-hidden rounded-lg border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- endpoint ต้อง auth จึงใช้ next/image ไม่ได้ */}
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="max-h-72 w-full object-contain"
                />
              </div>
            ) : null}
            <dl className="divide-y">
              <InfoRow
                label="หมวดหมู่"
                value={
                  <span className="inline-flex flex-wrap items-center justify-end gap-1">
                    {product.categoryName}
                    {!product.categoryIsActive ? (
                      <Badge variant="outline">ปิดใช้งาน</Badge>
                    ) : null}
                  </span>
                }
              />
              <InfoRow label="หน่วยนับ" value={product.unit} />
              <InfoRow label="ตำแหน่งจัดเก็บ" value={product.storageLocation ?? '—'} />
              <InfoRow
                label="คำอธิบาย"
                value={
                  <span className="font-normal text-muted-foreground">
                    {product.description ?? '—'}
                  </span>
                }
              />
              <InfoRow label="อัปเดตล่าสุด" value={formatDateTime(product.updatedAt)} />
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader>
            <CardTitle>สต๊อกคงเหลือ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <p className="text-3xl font-semibold tabular-nums">
                {product.currentStock.toLocaleString('th-TH')}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {product.unit}
                </span>
              </p>
              <StockStatusBadge status={status} />
            </div>

            <p className="text-sm text-muted-foreground">
              ยอดขั้นต่ำ {product.minStock.toLocaleString('th-TH')} {product.unit}
            </p>

            {status === 'OUT_OF_STOCK' ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                สินค้าหมดสต๊อก ควรรับเข้าโดยเร็ว
              </div>
            ) : null}

            {status === 'LOW' ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                คงเหลือไม่เกินยอดขั้นต่ำ ควรวางแผนเติมสินค้า
              </div>
            ) : null}

            {status === 'IN_STOCK' ? (
              <p className="text-xs text-muted-foreground">
                คงเหลือมากกว่ายอดขั้นต่ำ อยู่ในเกณฑ์ปกติ
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex-row items-start justify-between gap-2 border-b px-5 py-4">
          <div className="space-y-1">
            <CardTitle className="text-base">ประวัติการเคลื่อนไหว</CardTitle>
            <CardDescription>
              20 รายการล่าสุด · ประวัติไม่สามารถแก้ไขหรือลบได้
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/history?q=${encodeURIComponent(product.sku)}`}>ดูประวัติทั้งหมด</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ProductMovements items={movements} />
        </CardContent>
      </Card>
    </div>
  );
}
