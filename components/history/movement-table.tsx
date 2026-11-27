import Link from 'next/link';

import { MovementTypeBadge } from '@/components/stock/movement-type-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { formatSignedQuantity } from '@/lib/stock';
import type { StockHistoryItem } from '@/server/queries/stock';

export function MovementTable({ items }: { items: StockHistoryItem[] }) {
  return (
    <Table>
      <TableHeader className="bg-muted/40">
        <TableRow>
          <TableHead className="pl-5">วันที่</TableHead>
          <TableHead>สินค้า</TableHead>
          <TableHead>ประเภท</TableHead>
          <TableHead className="text-right">เปลี่ยนแปลง</TableHead>
          <TableHead className="text-right">ก่อน → หลัง</TableHead>
          <TableHead>ผู้เบิก / แผนก</TableHead>
          <TableHead>ผู้ดำเนินการ</TableHead>
          <TableHead className="hidden pr-5 xl:table-cell">หมายเหตุ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="pl-5 text-muted-foreground">
              {formatDateTime(item.createdAt)}
            </TableCell>
            <TableCell className="whitespace-normal">
              <Link
                href={`/products/${item.productId}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {item.productName}
              </Link>
              <p className="text-xs text-muted-foreground">{item.productSku}</p>
            </TableCell>
            <TableCell>
              <MovementTypeBadge type={item.type} />
            </TableCell>
            <TableCell
              className={
                item.quantityChange > 0
                  ? 'text-right font-medium tabular-nums text-emerald-600'
                  : 'text-right font-medium tabular-nums text-red-600'
              }
            >
              {formatSignedQuantity(item.quantityChange)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {item.productUnit}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {item.quantityBefore.toLocaleString('th-TH')} →{' '}
              {item.quantityAfter.toLocaleString('th-TH')}
            </TableCell>
            <TableCell className="whitespace-normal text-muted-foreground">
              {item.recipientName ? (
                <span>
                  {item.recipientName}
                  {item.department ? ` · ${item.department}` : ''}
                </span>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell>{item.performedByName}</TableCell>
            <TableCell className="hidden max-w-60 whitespace-normal pr-5 text-muted-foreground xl:table-cell">
              {item.note ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
