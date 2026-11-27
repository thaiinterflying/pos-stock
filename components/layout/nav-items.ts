import {
  HistoryIcon,
  LayoutDashboardIcon,
  PackageIcon,
  SettingsIcon,
  type LucideIcon,
} from 'lucide-react';

import type { AppRole } from '@/lib/constants';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: AppRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboardIcon },
  { href: '/products', label: 'สินค้า', icon: PackageIcon },
  { href: '/history', label: 'ประวัติ', icon: HistoryIcon },
  { href: '/settings', label: 'ตั้งค่า', icon: SettingsIcon, roles: ['ADMIN'] },
];

export function navItemsForRole(role: AppRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
