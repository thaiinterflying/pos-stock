import { randomUUID } from 'node:crypto';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/products/product-form';
import { PageHeader } from '@/components/shared/page-header';
import { productImageUrl } from '@/lib/product-image';
import { requireAdmin } from '@/server/auth/guard';
import { listCategoryOptions } from '@/server/queries/categories';
import { findProductById } from '@/server/queries/products';

export const metadata: Metadata = {
  title: 'แก้ไขสินค้า',
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const product = await findProductById(id);

  if (!product) {
    notFound();
  }

  const allCategories = await listCategoryOptions();
  // แสดงหมวดหมู่ที่ใช้งาน + หมวดหมู่เดิมของสินค้า (แม้ถูกปิดใช้งาน)
  const categories = allCategories.filter(
    (category) => category.isActive || category.id === product.categoryId,
  );

  // requestId ประจำการเปิดฟอร์ม — กันการบันทึกซ้ำหากผู้ใช้กดส่งหลายครั้ง
  const adjustmentRequestId = randomUUID();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`แก้ไข ${product.name}`}
        description={`SKU ${product.sku} · แก้ไขข้อมูลสินค้าและปรับจำนวนคงเหลือพร้อมเหตุผลได้ในหน้าเดียว`}
      />

      <ProductForm
        mode="edit"
        categories={categories}
        product={{
          id: product.id,
          sku: product.sku,
          name: product.name,
          categoryId: product.categoryId,
          unit: product.unit,
          minStock: product.minStock,
          storageLocation: product.storageLocation,
          description: product.description,
          currentStock: product.currentStock,
          imageUrl: productImageUrl(product.id, product.imageUpdatedAt),
        }}
        adjustmentRequestId={adjustmentRequestId}
      />
    </div>
  );
}
