import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  HistoryIcon,
  InfoIcon,
  PackageIcon,
  PackageSearchIcon,
  PlusIcon,
} from 'lucide-react';

import { LowStockList } from '@/components/dashboard/low-stock-list';
import { RecentMovementsList } from '@/components/dashboard/recent-movements';
import { StatCard } from '@/components/dashboard/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDate, getGreeting } from '@/lib/format';
import { requireUser } from '@/server/auth/guard';
import {
  getDashboardStats,
  listLowStockProducts,
  listRecentMovements,
} from '@/server/queries/dashboard';

export const metadata: Metadata = {
  title: 'แดชบอร์ด',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const [stats, lowStock, recentMovements] = await Promise.all([
    getDashboardStats(),
    listLowStockProducts(6),
    listRecentMovements(6),
  ]);

  const now = new Date();
  const canManage = user.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getGreeting(now)}, ${user.name}`}
        description={`ภาพรวมสต๊อกอุปกรณ์สำนักงาน · ${formatDate(now)}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/history">
            <HistoryIcon aria-hidden="true" />
            ดูประวัติ
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/products">
            <PackageIcon aria-hidden="true" />
            ดูรายการสินค้า
          </Link>
        </Button>
      </PageHeader>

      {params.forbidden ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>คุณไม่มีสิทธิ์เข้าถึงหน้านั้น เฉพาะผู้ดูแลระบบเท่านั้น</p>
        </div>
      ) : null}

      {stats.totalActive === 0 ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <div className="flex items-start gap-2.5">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-medium">เริ่มต้นใช้งาน TIF Stock</p>
              <p className="text-muted-foreground">
                {canManage
                  ? 'สร้างหมวดหมู่และเพิ่มสินค้ารายการแรกเพื่อเริ่มติดตามสต๊อก'
                  : 'ยังไม่มีสินค้าในระบบ กรุณาติดต่อผู้ดูแลระบบ'}
              </p>
            </div>
          </div>
          {canManage ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/products/new">
                <PlusIcon aria-hidden="true" />
                เพิ่มสินค้า
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="สินค้าทั้งหมด"
          value={stats.totalActive}
          hint="SKU ที่เปิดใช้งาน"
          icon={PackageIcon}
          href="/products"
        />
        <StatCard
          label="สถานะปกติ"
          value={stats.inStock}
          hint="สต๊อกมากกว่ายอดขั้นต่ำ"
          icon={CheckCircle2Icon}
          tone="success"
          href="/products?status=in_stock"
        />
        <StatCard
          label="ใกล้หมด"
          value={stats.lowStock}
          hint="เหลือไม่เกินยอดขั้นต่ำ"
          icon={AlertTriangleIcon}
          tone="warning"
          href="/products?status=low"
        />
        <StatCard
          label="หมดสต๊อก"
          value={stats.outOfStock}
          hint="ยอดคงเหลือเป็นศูนย์"
          icon={PackageSearchIcon}
          tone="danger"
          href="/products?status=out"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4">
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>สินค้าที่ควรเติม</CardTitle>
              <CardDescription>คงเหลือไม่เกินยอดขั้นต่ำ · เรียงรายการที่หมดก่อน</CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
            >
              <Link href="/products?status=attention">
                ดูทั้งหมด
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <LowStockList items={lowStock} />
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>ความเคลื่อนไหวล่าสุด</CardTitle>
              <CardDescription>6 รายการล่าสุดจากทุกสินค้า</CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
            >
              <Link href="/history">
                ดูทั้งหมด
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RecentMovementsList items={recentMovements} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
