'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react';
import { toast } from 'sonner';

import { CategoryFormDialog } from '@/components/settings/category-dialogs';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import type { CategoryWithCounts } from '@/server/queries/categories';
import { setCategoryActiveAction } from '@/server/actions/categories.actions';

export function CategoriesPanel({ categories }: { categories: CategoryWithCounts[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<CategoryWithCounts | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<CategoryWithCounts | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleConfirm() {
    if (!confirmTarget) return;
    const target = confirmTarget;

    startTransition(async () => {
      const result = await setCategoryActiveAction({
        categoryId: target.id,
        isActive: !target.isActive,
      });

      if (result.ok) {
        toast.success(result.message ?? 'อัปเดตสถานะเรียบร้อยแล้ว');
        setConfirmTarget(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon aria-hidden="true" />
          เพิ่มหมวดหมู่
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-4">
          <p className="text-sm text-muted-foreground">
            ทั้งหมด {categories.length.toLocaleString('th-TH')} หมวดหมู่
          </p>
        </CardHeader>

        <CardContent className="p-0">
          {categories.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={PlusIcon}
                title="ยังไม่มีหมวดหมู่"
                description="เริ่มสร้างหมวดหมู่แรกเพื่อใช้จัดกลุ่มสินค้า"
              >
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  เพิ่มหมวดหมู่
                </Button>
              </EmptyState>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="pl-5">หมวดหมู่</TableHead>
                  <TableHead>จำนวนสินค้า</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="hidden lg:table-cell">สร้างเมื่อ</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">การจัดการ</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => {
                  const blocked = category.isActive && category.activeProductCount > 0;

                  return (
                    <TableRow key={category.id}>
                      <TableCell className="pl-5 font-medium">{category.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        ใช้งาน {category.activeProductCount.toLocaleString('th-TH')} / ทั้งหมด{' '}
                        {category.productCount.toLocaleString('th-TH')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={category.isActive ? 'success' : 'outline'}>
                          {category.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {formatDateTime(category.createdAt)}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="แก้ไขชื่อหมวดหมู่"
                            aria-label={`แก้ไข ${category.name}`}
                            onClick={() => setEditTarget(category)}
                          >
                            <PencilIcon className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={
                              category.isActive
                                ? 'size-8 text-muted-foreground hover:text-destructive'
                                : 'size-8 text-muted-foreground hover:text-emerald-600'
                            }
                            title={
                              blocked
                                ? 'ต้องย้ายหรือปิดใช้งานสินค้าในหมวดนี้ก่อน'
                                : category.isActive
                                  ? 'ปิดใช้งาน'
                                  : 'เปิดใช้งาน'
                            }
                            aria-label={`${category.isActive ? 'ปิด' : 'เปิด'}ใช้งาน ${category.name}`}
                            disabled={blocked}
                            onClick={() => setConfirmTarget(category)}
                          >
                            {category.isActive ? (
                              <PowerOffIcon className="size-4" aria-hidden="true" />
                            ) : (
                              <PowerIcon className="size-4" aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ไม่สามารถปิดใช้งานหมวดหมู่ที่มีสินค้าใช้งานอยู่ได้ — ต้องย้ายหรือปิดใช้งานสินค้าเหล่านั้นก่อน
      </p>

      {createOpen ? <CategoryFormDialog onClose={() => setCreateOpen(false)} /> : null}

      {editTarget ? (
        <CategoryFormDialog
          category={{ id: editTarget.id, name: editTarget.name }}
          onClose={() => setEditTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={confirmTarget?.isActive ? 'ปิดใช้งานหมวดหมู่' : 'เปิดใช้งานหมวดหมู่'}
        description={
          confirmTarget?.isActive
            ? `${confirmTarget.name} จะไม่แสดงเป็นตัวเลือกให้สินค้าใหม่ แต่ประวัติยังอยู่ครบ`
            : `${confirmTarget?.name ?? ''} จะกลับมาใช้ได้อีกครั้ง`
        }
        confirmLabel={confirmTarget?.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
        destructive={Boolean(confirmTarget?.isActive)}
        pending={pending}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
