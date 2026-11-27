import type { Metadata } from 'next';
import Link from 'next/link';
import { DownloadIcon, FileSpreadsheetIcon, HistoryIcon, SearchIcon } from 'lucide-react';

import { HistoryFilters } from '@/components/history/history-filters';
import { MovementTable } from '@/components/history/movement-table';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseBangkokDayEndExclusive, parseBangkokDayStart } from '@/lib/date-range';
import { isMovementTypeName } from '@/lib/stock';
import { requireUser } from '@/server/auth/guard';
import { listStockMovements } from '@/server/queries/stock';

export const metadata: Metadata = {
  title: 'ประวัติ',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const params = await searchParams;

  const q = (firstParam(params.q) ?? '').trim().slice(0, 100);
  const typeParam = firstParam(params.type);
  const type = isMovementTypeName(typeParam) ? typeParam : undefined;
  const fromParam = firstParam(params.from) ?? '';
  const toParam = firstParam(params.to) ?? '';
  const from = parseBangkokDayStart(fromParam);
  const toExclusive = parseBangkokDayEndExclusive(toParam);
  const fromRaw = from ? fromParam : '';
  const toRaw = toExclusive ? toParam : '';
  const requestedPage = Math.max(
    Number.parseInt(firstParam(params.page) ?? '1', 10) || 1,
    1,
  );

  const result = await listStockMovements({
    q: q || undefined,
    type,
    from: from ?? undefined,
    toExclusive: toExclusive ?? undefined,
    page: requestedPage,
  });

  const hasFilters = Boolean(q || type || from || toExclusive);

  function makePageHref(page: number): string {
    const search = new URLSearchParams();

    if (q) search.set('q', q);
    if (type) search.set('type', type);
    if (fromRaw) search.set('from', fromRaw);
    if (toRaw) search.set('to', toRaw);
    if (page > 1) search.set('page', String(page));

    const queryString = search.toString();
    return queryString ? `/history?${queryString}` : '/history';
  }

  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (type) exportParams.set('type', type);
  if (fromRaw) exportParams.set('from', fromRaw);
  if (toRaw) exportParams.set('to', toRaw);
  const exportQuery = exportParams.toString();
  const exportHref = `/api/export/stock-movements${exportQuery ? `?${exportQuery}` : ''}`;
  const exportXlsxHref = `${exportHref}${exportQuery ? '&' : '?'}format=xlsx`;
  const canExport = actor.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <PageHeader
        title="ประวัติการเคลื่อนไหว"
        description="รายการรับเข้า เบิกออก ปรับยอด และยอดยกมา · ประวัติไม่สามารถแก้ไขหรือลบได้"
      >
        {canExport ? (
          result.total > 0 ? (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={exportXlsxHref} download>
                  <FileSpreadsheetIcon aria-hidden="true" />
                  Export Excel
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={exportHref} download>
                  <DownloadIcon aria-hidden="true" />
                  Export CSV
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                title="ยังไม่มีข้อมูลให้ Export"
              >
                <FileSpreadsheetIcon aria-hidden="true" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                title="ยังไม่มีข้อมูลให้ Export"
              >
                <DownloadIcon aria-hidden="true" />
                Export CSV
              </Button>
            </div>
          )
        ) : null}
      </PageHeader>

      <HistoryFilters
        initialQ={q}
        initialType={type ?? ''}
        initialFrom={fromRaw}
        initialTo={toRaw}
      />

      {result.total === 0 ? (
        <EmptyState
          icon={hasFilters ? SearchIcon : HistoryIcon}
          title={hasFilters ? 'ไม่พบประวัติที่ตรงกับตัวกรอง' : 'ยังไม่มีการเคลื่อนไหว'}
          description={
            hasFilters
              ? 'ลองปรับช่วงวันที่ ประเภท หรือคำค้นหา แล้วลองอีกครั้ง'
              : 'เมื่อมีการรับเข้า เบิกออก หรือปรับยอด รายการจะแสดงที่นี่'
          }
          className="bg-card py-16"
        >
          {hasFilters ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/history">ล้างตัวกรอง</Link>
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="flex-row items-center justify-between gap-2 border-b px-5 py-4">
            <CardTitle className="text-base">รายการเคลื่อนไหว</CardTitle>
            <p className="text-xs text-muted-foreground">
              ทั้งหมด {result.total.toLocaleString('th-TH')} รายการ
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <MovementTable items={result.items} />
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              pageSize={result.pageSize}
              makeHref={makePageHref}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
