'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOutIcon, MenuIcon } from 'lucide-react';

import { Brand } from '@/components/layout/brand';
import { isNavItemActive, navItemsForRole } from '@/components/layout/nav-items';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ROLE_LABELS } from '@/lib/constants';
import type { CurrentUser } from '@/lib/types';
import { cn, getInitials } from '@/lib/utils';
import { logoutAction } from '@/server/actions/auth.actions';

function SidebarNav({ user, onNavigate }: { user: CurrentUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = navItemsForRole(user.role);

  return (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="เมนูหลัก">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBadge({ user }: { user: CurrentUser }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {getInitials(user.name)}
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
      </div>
    </div>
  );
}

function LogoutForm({ className }: { className?: string }) {
  return (
    <form action={logoutAction} className={className}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
        aria-label="ออกจากระบบ"
      >
        <LogOutIcon className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">ออกจากระบบ</span>
      </Button>
    </form>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-svh bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Brand />
        </div>
        <SidebarNav user={user} />
        <div className="border-t px-5 py-4">
          <p className="text-[11px] text-muted-foreground">TIF Stock v0.1.0</p>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="เปิดเมนู"
          >
            <MenuIcon className="size-5" />
          </Button>
          <div className="md:hidden">
            <Brand compact />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:block">
              <UserBadge user={user} />
            </div>
            <LogoutForm />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="h-16 justify-center border-b px-5">
            <SheetTitle className="sr-only">เมนูหลัก</SheetTitle>
            <Brand />
          </SheetHeader>
          <SidebarNav user={user} onNavigate={() => setMobileOpen(false)} />
          <div className="space-y-3 border-t p-4">
            <UserBadge user={user} />
            <LogoutForm className="[&_button]:w-full [&_span]:inline" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
