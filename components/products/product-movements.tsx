import { HistoryIcon } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
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
import type { ProductMovementItem } from '@/server/queries/products';

export function ProductMovements({ items }: { items: ProductMovementItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="ยังไม่มีการเคลื่อนไหว"
        description="รายการรับเข้า เบิกออก และปรับยอดของสินค้านี้จะแสดงที่นี่"
        className="border-0 bg-transparent"
      />
    );
  }

  return (
    <Table>
      <TableHeader className="bg-muted/40">
        <TableRow>
          <TableHead className="pl-5">วันที่</TableHead>
          <TableHead>ประเภท</TableHead>
          <TableHead className="text-right">เปลี่ยนแปลง</TableHead>
          <TableHead className="text-right">ก่อน → หลัง</TableHead>
          <TableHead>ผู้ดำเนินการ</TableHead>
          <TableHead>ผู้เบิก / แผนก</TableHead>
          <TableHead className="hidden pr-5 lg:table-cell">หมายเหตุ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="pl-5 text-muted-foreground">
              {formatDateTime(item.createdAt)}
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
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {item.quantityBefore.toLocaleString('th-TH')} →{' '}
              {item.quantityAfter.toLocaleString('th-TH')}
            </TableCell>
            <TableCell>{item.performedByName}</TableCell>
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
            <TableCell className="hidden max-w-60 whitespace-normal pr-5 text-muted-foreground lg:table-cell">
              {item.note ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
