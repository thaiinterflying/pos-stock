import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/server/auth/guard';

export const metadata: Metadata = {
  title: 'ตั้งค่า',
};

export default async function SettingsPage() {
  await requireAdmin();
  redirect('/settings/users');
}
