import { Badge } from '@/components/ui/badge';
import { MOVEMENT_TYPE_LABELS, type MovementTypeName } from '@/lib/stock';

const VARIANTS: Record<
  MovementTypeName,
  React.ComponentProps<typeof Badge>['variant']
> = {
  OPENING: 'secondary',
  IN: 'success',
  OUT: 'warning',
  ADJUSTMENT: 'default',
};

export function MovementTypeBadge({ type }: { type: MovementTypeName }) {
  return <Badge variant={VARIANTS[type]}>{MOVEMENT_TYPE_LABELS[type]}</Badge>;
}
