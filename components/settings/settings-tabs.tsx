import Link from 'next/link';

import { cn } from '@/lib/utils';

const TABS = [
  { key: 'users', href: '/settings/users', label: 'ผู้ใช้งาน' },
  { key: 'categories', href: '/settings/categories', label: 'หมวดหมู่' },
] as const;

export function SettingsTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <nav className="flex gap-1 border-b" aria-label="เมนูตั้งค่า">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              isActive
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
