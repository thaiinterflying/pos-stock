import { BoxesIcon } from 'lucide-react';

import { APP_COMPANY, APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

type BrandProps = {
  inverted?: boolean;
  compact?: boolean;
  className?: string;
};

export function Brand({ inverted = false, compact = false, className }: BrandProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'flex size-9 items-center justify-center rounded-lg shadow-sm',
          inverted
            ? 'bg-white/10 text-white ring-1 ring-white/20'
            : 'bg-primary text-primary-foreground',
        )}
      >
        <BoxesIcon className="size-5" aria-hidden="true" />
      </div>
      <div className="leading-tight">
        <p
          className={cn(
            'text-[15px] font-semibold tracking-tight',
            inverted ? 'text-white' : 'text-foreground',
          )}
        >
          {APP_NAME}
        </p>
        {!compact && (
          <p className={cn('text-[11px]', inverted ? 'text-white/60' : 'text-muted-foreground')}>
            {APP_COMPANY}
          </p>
        )}
      </div>
    </div>
  );
}
