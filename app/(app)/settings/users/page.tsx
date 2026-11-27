import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { UsersPanel } from '@/components/settings/users-panel';
import { requireAdmin } from '@/server/auth/guard';
import { listUsers } from '@/server/queries/users';

export const metadata: Metadata = {
  title: 'ผู้ใช้งาน',
};

export default async function UsersSettingsPage() {
  const actor = await requireAdmin();
  const users = await listUsers();

  return (
    <div className="space-y-6">
      <PageHeader title="ตั้งค่า" description="จัดการผู้ใช้งานและสิทธิ์การเข้าถึงระบบ" />
      <SettingsTabs active="users" />
      <UsersPanel users={users} currentUserId={actor.id} />
    </div>
  );
}
