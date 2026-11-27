import Link from 'next/link';
import { HistoryIcon } from 'lucide-react';

import { MovementTypeBadge } from '@/components/stock/movement-type-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDateTime } from '@/lib/format';
import { formatSignedQuantity } from '@/lib/stock';
import { cn } from '@/lib/utils';
import type { RecentMovementItem } from '@/server/queries/dashboard';

export function RecentMovementsList({ items }: { items: RecentMovementItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="ยังไม่มีการเคลื่อนไหว"
        description="รายการรับเข้า เบิกออก และปรับยอดล่าสุดจะแสดงที่นี่"
        className="border-0 bg-transparent py-8"
      />
    );
  }

  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <MovementTypeBadge type={item.type} />
              <Link
                href={`/products/${item.productId}`}
                className="truncate text-sm font-medium hover:text-primary hover:underline"
              >
                {item.productName}
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              {item.performedByName} · {formatDateTime(item.createdAt)}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p
              className={cn(
                'text-sm font-medium tabular-nums',
                item.quantityChange > 0 ? 'text-emerald-600' : 'text-red-600',
              )}
            >
              {formatSignedQuantity(item.quantityChange)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {item.productUnit}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              คงเหลือ {item.quantityAfter.toLocaleString('th-TH')}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
