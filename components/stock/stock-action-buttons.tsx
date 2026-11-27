'use client';

import * as React from 'react';
import { PackageMinusIcon, PackagePlusIcon, SlidersHorizontalIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { StockMovementDialog } from './stock-movement-dialog';
import type { StockActionProduct, StockMovementMode } from './types';

type StockActionButtonsProps = {
  product: StockActionProduct;
  variant?: 'icon' | 'full';
  canAdjust?: boolean;
};

export function StockActionButtons({
  product,
  variant = 'full',
  canAdjust = false,
}: StockActionButtonsProps) {
  const [mode, setMode] = React.useState<StockMovementMode | null>(null);
  const disabled = !product.isActive;
  const disabledTitle = disabled ? 'สินค้าถูกปิดใช้งาน ไม่สามารถเคลื่อนไหวสต๊อกได้' : undefined;

  const dialog = mode ? (
    <StockMovementDialog mode={mode} product={product} onClose={() => setMode(null)} />
  ) : null;

  if (variant === 'icon') {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-emerald-600"
          title={disabledTitle ?? 'รับเข้า'}
          aria-label={`รับเข้า ${product.name}`}
          disabled={disabled}
          onClick={() => setMode('IN')}
        >
          <PackagePlusIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-amber-600"
          title={disabledTitle ?? 'เบิกออก'}
          aria-label={`เบิกออก ${product.name}`}
          disabled={disabled}
          onClick={() => setMode('OUT')}
        >
          <PackageMinusIcon className="size-4" aria-hidden="true" />
        </Button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <Button size="sm" onClick={() => setMode('IN')} disabled={disabled} title={disabledTitle}>
        <PackagePlusIcon aria-hidden="true" />
        รับเข้า
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setMode('OUT')}
        disabled={disabled}
        title={disabledTitle}
      >
        <PackageMinusIcon aria-hidden="true" />
        เบิกออก
      </Button>
      {canAdjust ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode('ADJUST')}
          disabled={disabled}
          title={disabledTitle}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
          ปรับยอด
        </Button>
      ) : null}
      {dialog}
    </>
  );
}
