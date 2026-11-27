import Link from 'next/link';
import { EyeIcon, PackageIcon, PencilIcon } from 'lucide-react';

import { StockActionButtons } from '@/components/stock/stock-action-buttons';
import { StockStatusBadge } from '@/components/products/stock-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { productImageUrl } from '@/lib/product-image';
import type { ProductListItem } from '@/server/queries/products';

type ProductTableProps = {
  items: ProductListItem[];
  canManage: boolean;
};

export function ProductTable({ items, canManage }: ProductTableProps) {
  return (
    <Table>
      <TableHeader className="bg-muted/40">
        <TableRow>
          <TableHead className="pl-5">สินค้า</TableHead>
          <TableHead>หมวดหมู่</TableHead>
          <TableHead className="text-right">คงเหลือ</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead className="hidden md:table-cell">ตำแหน่งจัดเก็บ</TableHead>
          <TableHead className="pr-5 text-right">
            <span className="sr-only">การจัดการ</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="whitespace-normal pl-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {productImageUrl(item.id, item.imageUpdatedAt) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- endpoint ต้อง auth จึงใช้ next/image ไม่ได้
                    <img
                      src={productImageUrl(item.id, item.imageUpdatedAt) ?? undefined}
                      alt={item.name}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <PackageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/products/${item.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{item.categoryName}</TableCell>
            <TableCell className="text-right">
              <span className="font-medium tabular-nums">
                {item.currentStock.toLocaleString('th-TH')}
              </span>{' '}
              <span className="text-xs text-muted-foreground">{item.unit}</span>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1">
                <StockStatusBadge status={item.status} />
                {!item.isActive ? <Badge variant="outline">ปิดใช้งาน</Badge> : null}
              </div>
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {item.storageLocation ?? '—'}
            </TableCell>
            <TableCell className="pr-5 text-right">
              <div className="flex items-center justify-end gap-1">
                <StockActionButtons
                  product={{
                    id: item.id,
                    name: item.name,
                    sku: item.sku,
                    unit: item.unit,
                    currentStock: item.currentStock,
                    minStock: item.minStock,
                    isActive: item.isActive,
                  }}
                  variant="icon"
                />
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="ดูรายละเอียด"
                  aria-label={`ดูรายละเอียด ${item.name}`}
                >
                  <Link href={`/products/${item.id}`}>
                    <EyeIcon className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                {canManage ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="แก้ไขสินค้า"
                    aria-label={`แก้ไข ${item.name}`}
                  >
                    <Link href={`/products/${item.id}/edit`}>
                      <PencilIcon className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
