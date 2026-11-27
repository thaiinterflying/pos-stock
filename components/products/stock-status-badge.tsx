import { Badge } from '@/components/ui/badge';
import { STOCK_STATUS_LABELS, type StockStatus } from '@/lib/stock';

const VARIANTS: Record<StockStatus, 'success' | 'warning' | 'destructive'> = {
  IN_STOCK: 'success',
  LOW: 'warning',
  OUT_OF_STOCK: 'destructive',
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <Badge variant={VARIANTS[status]}>{STOCK_STATUS_LABELS[status]}</Badge>;
}
