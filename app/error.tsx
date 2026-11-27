'use client';

import { AlertTriangleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangleIcon className="size-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">เกิดข้อผิดพลาด</h1>
          <p className="text-sm text-muted-foreground">
            ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูลแล้วลองอีกครั้ง
          </p>
        </div>
        <Button onClick={reset} className="w-full">
          ลองอีกครั้ง
        </Button>
        {error.digest ? (
          <p className="text-[11px] text-muted-foreground">รหัสอ้างอิง: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
