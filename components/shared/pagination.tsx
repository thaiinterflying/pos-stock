import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  makeHref: (page: number) => string;
};

export function Pagination({ page, totalPages, total, pageSize, makeHref }: PaginationProps) {
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        แสดง {start.toLocaleString('th-TH')}–{end.toLocaleString('th-TH')} จาก{' '}
        {total.toLocaleString('th-TH')} รายการ
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={makeHref(page - 1)} rel="prev">
                <ChevronLeftIcon aria-hidden="true" />
                ก่อนหน้า
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeftIcon aria-hidden="true" />
              ก่อนหน้า
            </Button>
          )}

          <span className="text-xs text-muted-foreground">
            หน้า {page.toLocaleString('th-TH')} / {totalPages.toLocaleString('th-TH')}
          </span>

          {page < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={makeHref(page + 1)} rel="next">
                ถัดไป
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              ถัดไป
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
