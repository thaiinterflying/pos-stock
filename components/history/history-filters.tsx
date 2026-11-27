'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

type HistoryFiltersProps = {
  initialQ: string;
  initialType: string;
  initialFrom: string;
  initialTo: string;
};

export function HistoryFilters({
  initialQ,
  initialType,
  initialFrom,
  initialTo,
}: HistoryFiltersProps) {
  const router = useRouter();
  const [q, setQ] = React.useState(initialQ);
  const [type, setType] = React.useState(initialType);
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);

  React.useEffect(() => {
    setQ(initialQ);
    setType(initialType);
    setFrom(initialFrom);
    setTo(initialTo);
  }, [initialQ, initialType, initialFrom, initialTo]);

  function submitFilters(next: { q: string; type: string; from: string; to: string }) {
    const params = new URLSearchParams();
    const trimmedQuery = next.q.trim();

    if (trimmedQuery) params.set('q', trimmedQuery);
    if (next.type) params.set('type', next.type);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);

    const queryString = params.toString();
    router.push(queryString ? `/history?${queryString}` : '/history', { scroll: false });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitFilters({ q, type, from, to });
  }

  const hasFilters = Boolean(initialQ || initialType || initialFrom || initialTo);

  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="history-search">สินค้า</Label>
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="history-search"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="ค้นหาชื่อสินค้าหรือ SKU"
                  className="pl-9"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-1.5 md:w-40">
              <Label htmlFor="history-type">ประเภท</Label>
              <NativeSelect
                id="history-type"
                value={type}
                onChange={(event) => {
                  const value = event.target.value;
                  setType(value);
                  submitFilters({ q, type: value, from, to });
                }}
              >
                <option value="">ทุกประเภท</option>
                <option value="OPENING">ยอดยกมา</option>
                <option value="IN">รับเข้า</option>
                <option value="OUT">เบิกออก</option>
                <option value="ADJUSTMENT">ปรับยอด</option>
              </NativeSelect>
            </div>

            <div className="space-y-1.5 md:w-40">
              <Label htmlFor="history-from">ตั้งแต่วันที่</Label>
              <Input
                id="history-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                max={to || undefined}
              />
            </div>

            <div className="space-y-1.5 md:w-40">
              <Label htmlFor="history-to">ถึงวันที่</Label>
              <Input
                id="history-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                min={from || undefined}
              />
            </div>

            <Button type="submit" variant="secondary">
              <SearchIcon aria-hidden="true" />
              ค้นหา
            </Button>
          </div>

          {hasFilters ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => router.push('/history')}
              >
                <XIcon aria-hidden="true" />
                ล้างตัวกรอง
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
