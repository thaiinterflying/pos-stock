import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONES = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
} as const;

export type StatTone = keyof typeof TONES;

type StatCardProps = {
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  tone?: StatTone;
  href?: string;
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', href }: StatCardProps) {
  const card = (
    <Card className="gap-0 py-5">
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {value.toLocaleString('th-TH')}
          </p>
        </div>
        <div
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', TONES[tone])}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      {hint ? <p className="px-5 pt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="block rounded-xl transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {card}
    </Link>
  );
}
