import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageIcon, PlusIcon, SearchIcon, TagsIcon } from 'lucide-react';

import { ProductFilters } from '@/components/products/product-filters';
import { ProductTable } from '@/components/products/product-table';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  parseStockStatusParam,
  stockStatusToParam,
  type StockStatus,
} from '@/lib/stock';
import { requireUser } from '@/server/auth/guard';
import { listCategoryOptions } from '@/server/queries/categories';
import { listProducts } from '@/server/queries/products';

export const metadata: Metadata = {
  title: 'สินค้า',
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [actor, params] = await Promise.all([requireUser(), searchParams]);

  const q = (firstParam(params.q) ?? '').trim().slice(0, 100);
  const categoryParam = firstParam(params.category);
  const categoryId =
    categoryParam && UUID_PATTERN.test(categoryParam) ? categoryParam : undefined;
  const statusParam = firstParam(params.status);
  const attention = statusParam === 'attention';
  const status = attention ? undefined : parseStockStatusParam(statusParam);
  const includeInactive =
    actor.role === 'ADMIN' && firstParam(params.inactive) === '1';
  const requestedPage = Math.max(
    Number.parseInt(firstParam(params.page) ?? '1', 10) || 1,
    1,
  );

  const [result, categories] = await Promise.all([
    listProducts({
      q: q || undefined,
      categoryId,
      status,
      attention,
      includeInactive,
      page: requestedPage,
    }),
    listCategoryOptions(),
  ]);

  const canManage = actor.role === 'ADMIN';
  const hasActiveCategories = categories.some((category) => category.isActive);
  const filterCategories = canManage
    ? categories
    : categories.filter((category) => category.isActive);
  const hasFilters = Boolean(q || categoryId || status || attention || includeInactive);

  function makePageHref(page: number): string {
    const search = new URLSearchParams();

    if (q) search.set('q', q);
    if (categoryId) search.set('category', categoryId);
    if (attention) search.set('status', 'attention');
    else if (status) search.set('status', stockStatusToParam(status));
    if (includeInactive) search.set('inactive', '1');
    if (page > 1) search.set('page', String(page));

    const queryString = search.toString();
    return queryString ? `/products?${queryString}` : '/products';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="สินค้า"
        description="ค้นหาและตรวจสอบจำนวนคงเหลือของอุปกรณ์สำนักงาน"
      >
        {canManage && hasActiveCategories ? (
          <Button asChild size="sm">
            <Link href="/products/new">
              <PlusIcon aria-hidden="true" />
              เพิ่มสินค้า
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      <ProductFilters
        initialQ={q}
        initialCategoryId={categoryId ?? ''}
        initialStatus={attention ? 'attention' : status ? stockStatusToParam(status) : ''}
        initialIncludeInactive={includeInactive}
        canIncludeInactive={canManage}
        categories={filterCategories}
      />

      {result.total === 0 ? (
        <EmptyState
          icon={hasFilters ? SearchIcon : PackageIcon}
          title={hasFilters ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้า'}
          description={
            hasFilters
              ? 'ลองปรับคำค้นหา หมวดหมู่ หรือสถานะสต๊อก แล้วลองอีกครั้ง'
              : hasActiveCategories
                ? 'เริ่มเพิ่มสินค้าชิ้นแรกพร้อมยอดเริ่มต้น เพื่อให้ระบบบันทึกยอดยกมาให้อัตโนมัติ'
                : 'ต้องมีหมวดหมู่ที่ใช้งานอย่างน้อย 1 หมวดหมู่ก่อนจึงจะเพิ่มสินค้าได้'
          }
          className="bg-card py-16"
        >
          {hasFilters ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/products">ล้างตัวกรอง</Link>
            </Button>
          ) : canManage ? (
            <Button asChild size="sm">
              <Link href={hasActiveCategories ? '/products/new' : '/settings/categories'}>
                {hasActiveCategories ? (
                  <PlusIcon aria-hidden="true" />
                ) : (
                  <TagsIcon aria-hidden="true" />
                )}
                {hasActiveCategories ? 'เพิ่มสินค้า' : 'ไปที่จัดการหมวดหมู่'}
              </Link>
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="flex-row items-center justify-between gap-2 border-b px-5 py-4">
            <CardTitle className="text-base">รายการสินค้า</CardTitle>
            <p className="text-xs text-muted-foreground">
              ทั้งหมด {result.total.toLocaleString('th-TH')} รายการ
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ProductTable items={result.items} canManage={canManage} />
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              pageSize={result.pageSize}
              makeHref={makePageHref}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
