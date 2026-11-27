'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  UserCheckIcon,
  UserXIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import type { UserSummary } from '@/lib/types';
import { setUserActiveAction } from '@/server/actions/users.actions';

import { CreateUserDialog, EditUserDialog, ResetPasswordDialog } from './user-dialogs';

export function UsersPanel({
  users,
  currentUserId,
}: {
  users: UserSummary[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<UserSummary | null>(null);
  const [resetTarget, setResetTarget] = React.useState<UserSummary | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<UserSummary | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;

    return users.filter((user) =>
      [user.name, user.email, ROLE_LABELS[user.role]].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [users, query]);

  const activeCount = users.filter((user) => user.isActive).length;

  function handleToggleActive() {
    if (!confirmTarget) return;
    const target = confirmTarget;

    startTransition(async () => {
      const result = await setUserActiveAction({
        userId: target.id,
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

  const confirmTitle = confirmTarget
    ? confirmTarget.isActive
      ? 'ปิดใช้งานผู้ใช้'
      : 'เปิดใช้งานผู้ใช้'
    : '';

  const confirmDescription = confirmTarget
    ? confirmTarget.isActive
      ? `${confirmTarget.name} จะออกจากระบบทันที และไม่สามารถเข้าสู่ระบบได้อีกจนกว่าจะเปิดใช้งาน`
      : `${confirmTarget.name} จะสามารถเข้าสู่ระบบได้อีกครั้ง`
    : undefined;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        ทั้งหมด {users.length.toLocaleString('th-TH')} บัญชี · ใช้งานอยู่{' '}
        {activeCount.toLocaleString('th-TH')} บัญชี
      </p>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อหรืออีเมล"
              className="pl-9"
              aria-label="ค้นหาผู้ใช้"
            />
          </div>

          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon aria-hidden="true" />
            เพิ่มผู้ใช้
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="pl-5">ผู้ใช้</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="hidden lg:table-cell">สร้างเมื่อ</TableHead>
                <TableHead className="pr-5 text-right">
                  <span className="sr-only">การจัดการ</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => {
                const isSelf = user.id === currentUserId;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="pl-5">
                      <div className="min-w-0">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'success' : 'outline'}>
                        {user.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatDateTime(user.createdAt)}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {isSelf ? (
                        <Badge variant="outline">บัญชีของคุณ</Badge>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="แก้ไขผู้ใช้"
                            aria-label={`แก้ไข ${user.name}`}
                            onClick={() => setEditTarget(user)}
                          >
                            <PencilIcon className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="รีเซ็ตรหัสผ่าน"
                            aria-label={`รีเซ็ตรหัสผ่านของ ${user.name}`}
                            onClick={() => setResetTarget(user)}
                          >
                            <KeyRoundIcon className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={
                              user.isActive
                                ? 'size-8 text-muted-foreground hover:text-destructive'
                                : 'size-8 text-muted-foreground hover:text-emerald-600'
                            }
                            title={user.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                            aria-label={`${user.isActive ? 'ปิด' : 'เปิด'}ใช้งาน ${user.name}`}
                            onClick={() => setConfirmTarget(user)}
                          >
                            {user.isActive ? (
                              <UserXIcon className="size-4" aria-hidden="true" />
                            ) : (
                              <UserCheckIcon className="size-4" aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={SearchIcon}
                title="ไม่พบผู้ใช้ที่ค้นหา"
                description="ลองใช้คำค้นอื่น หรือล้างคำค้นเพื่อแสดงรายชื่อทั้งหมด"
              >
                <Button type="button" variant="outline" size="sm" onClick={() => setQuery('')}>
                  ล้างคำค้น
                </Button>
              </EmptyState>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {createOpen ? <CreateUserDialog onClose={() => setCreateOpen(false)} /> : null}

      {editTarget ? (
        <EditUserDialog
          user={editTarget}
          isSelf={editTarget.id === currentUserId}
          onClose={() => setEditTarget(null)}
        />
      ) : null}

      {resetTarget ? (
        <ResetPasswordDialog
          user={resetTarget}
          isSelf={resetTarget.id === currentUserId}
          onClose={() => setResetTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmTarget?.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
        destructive={Boolean(confirmTarget?.isActive)}
        pending={isPending}
        onConfirm={handleToggleActive}
      />
    </div>
  );
}
