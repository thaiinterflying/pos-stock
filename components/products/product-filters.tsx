'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

type CategoryFilterOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type ProductFiltersProps = {
  initialQ: string;
  initialCategoryId: string;
  initialStatus: string;
  initialIncludeInactive: boolean;
  canIncludeInactive: boolean;
  categories: CategoryFilterOption[];
};

export function ProductFilters({
  initialQ,
  initialCategoryId,
  initialStatus,
  initialIncludeInactive,
  canIncludeInactive,
  categories,
}: ProductFiltersProps) {
  const router = useRouter();
  const [q, setQ] = React.useState(initialQ);
  const [categoryId, setCategoryId] = React.useState(initialCategoryId);
  const [status, setStatus] = React.useState(initialStatus);
  const [includeInactive, setIncludeInactive] = React.useState(initialIncludeInactive);

  React.useEffect(() => {
    setQ(initialQ);
    setCategoryId(initialCategoryId);
    setStatus(initialStatus);
    setIncludeInactive(initialIncludeInactive);
  }, [initialQ, initialCategoryId, initialStatus, initialIncludeInactive]);

  function submitFilters(next: {
    q: string;
    categoryId: string;
    status: string;
    includeInactive: boolean;
  }) {
    const params = new URLSearchParams();
    const trimmedQuery = next.q.trim();

    if (trimmedQuery) params.set('q', trimmedQuery);
    if (next.categoryId) params.set('category', next.categoryId);
    if (next.status) params.set('status', next.status);
    if (next.includeInactive && canIncludeInactive) params.set('inactive', '1');

    const queryString = params.toString();
    router.push(queryString ? `/products?${queryString}` : '/products', { scroll: false });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitFilters({ q, categoryId, status, includeInactive });
  }

  const hasFilters = Boolean(initialQ || initialCategoryId || initialStatus || initialIncludeInactive);

  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="product-search">ค้นหา</Label>
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="product-search"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="ค้นหาชื่อสินค้าหรือ SKU"
                  className="pl-9"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-1.5 md:w-44">
              <Label htmlFor="product-category">หมวดหมู่</Label>
              <NativeSelect
                id="product-category"
                value={categoryId}
                onChange={(event) => {
                  const value = event.target.value;
                  setCategoryId(value);
                  submitFilters({ q, categoryId: value, status, includeInactive });
                }}
              >
                <option value="">ทุกหมวดหมู่</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isActive ? '' : ' (ปิดใช้งาน)'}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5 md:w-40">
              <Label htmlFor="product-status">สถานะสต๊อก</Label>
              <NativeSelect
                id="product-status"
                value={status}
                onChange={(event) => {
                  const value = event.target.value;
                  setStatus(value);
                  submitFilters({ q, categoryId, status: value, includeInactive });
                }}
              >
                <option value="">ทุกสถานะ</option>
                <option value="attention">ควรเติม (ใกล้หมด/หมด)</option>
                <option value="in_stock">ปกติ</option>
                <option value="low">ใกล้หมด</option>
                <option value="out">หมดสต๊อก</option>
              </NativeSelect>
            </div>

            <Button type="submit" variant="secondary">
              <SearchIcon aria-hidden="true" />
              ค้นหา
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {canIncludeInactive ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={includeInactive}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIncludeInactive(checked);
                    submitFilters({ q, categoryId, status, includeInactive: checked });
                  }}
                />
                รวมสินค้าที่ปิดใช้งาน
              </label>
            ) : (
              <span />
            )}

            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => router.push('/products')}
              >
                <XIcon aria-hidden="true" />
                ล้างตัวกรอง
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
