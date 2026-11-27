import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <p className="text-5xl font-semibold text-primary">404</p>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">ไม่พบหน้าที่ต้องการ</h1>
          <p className="text-sm text-muted-foreground">
            หน้านี้อาจถูกย้ายหรือไม่มีอยู่ในระบบ
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/dashboard">กลับไปที่แดชบอร์ด</Link>
        </Button>
      </div>
    </div>
  );
}
