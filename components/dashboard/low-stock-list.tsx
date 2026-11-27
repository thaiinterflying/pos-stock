import Link from 'next/link';
import { CheckCircle2Icon } from 'lucide-react';

import { StockActionButtons } from '@/components/stock/stock-action-buttons';
import { StockStatusBadge } from '@/components/products/stock-status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import type { LowStockItem } from '@/server/queries/dashboard';

export function LowStockList({ items }: { items: LowStockItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2Icon}
        title="ไม่มีสินค้าที่ต้องเติม"
        description="ทุกรายการมียอดคงเหลือมากกว่ายอดขั้นต่ำ"
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
          <div className="min-w-0">
            <Link
              href={`/products/${item.id}`}
              className="block truncate text-sm font-medium hover:text-primary hover:underline"
            >
              {item.name}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.sku} · เหลือ {item.currentStock.toLocaleString('th-TH')} / ขั้นต่ำ{' '}
              {item.minStock.toLocaleString('th-TH')} {item.unit}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <StockStatusBadge status={item.status} />
            <StockActionButtons
              product={{
                id: item.id,
                name: item.name,
                sku: item.sku,
                unit: item.unit,
                currentStock: item.currentStock,
                minStock: item.minStock,
                isActive: true,
              }}
              variant="icon"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
