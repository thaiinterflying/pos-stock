import type { Metadata } from 'next';

import { CategoriesPanel } from '@/components/settings/categories-panel';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { PageHeader } from '@/components/shared/page-header';
import { requireAdmin } from '@/server/auth/guard';
import { listCategoriesWithCounts } from '@/server/queries/categories';

export const metadata: Metadata = {
  title: 'หมวดหมู่',
};

export default async function CategoriesSettingsPage() {
  await requireAdmin();
  const categories = await listCategoriesWithCounts();

  return (
    <div className="space-y-6">
      <PageHeader title="ตั้งค่า" description="จัดการผู้ใช้งานและหมวดหมู่สินค้า" />
      <SettingsTabs active="categories" />
      <CategoriesPanel categories={categories} />
    </div>
  );
}
