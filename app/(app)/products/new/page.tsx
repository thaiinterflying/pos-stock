import type { Metadata } from 'next';
import Link from 'next/link';
import { TagsIcon } from 'lucide-react';

import { ProductForm } from '@/components/products/product-form';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/server/auth/guard';
import { listCategoryOptions } from '@/server/queries/categories';

export const metadata: Metadata = {
  title: 'เพิ่มสินค้า',
};

export default async function NewProductPage() {
  await requireAdmin();
  const categories = (await listCategoryOptions()).filter((category) => category.isActive);

  return (
    <div className="space-y-6">
      <PageHeader
        title="เพิ่มสินค้า"
        description="สร้างรายการสินค้าใหม่พร้อมยอดเริ่มต้น (ถ้ามี)"
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={TagsIcon}
          title="ยังไม่มีหมวดหมู่ที่ใช้งาน"
          description="ต้องสร้างหมวดหมู่ที่ใช้งานอย่างน้อย 1 หมวดหมู่ก่อนจึงจะเพิ่มสินค้าได้"
          className="bg-card py-16"
        >
          <Button asChild size="sm">
            <Link href="/settings/categories">ไปที่จัดการหมวดหมู่</Link>
          </Button>
        </EmptyState>
      ) : (
        <ProductForm mode="create" categories={categories} />
      )}
    </div>
  );
}
