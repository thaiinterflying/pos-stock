import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckCircle2Icon } from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';
import { Brand } from '@/components/layout/brand';
import { getCurrentUser } from '@/server/auth/session';
import { safeInternalPath } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
};

const HIGHLIGHTS = [
  'ตรวจสอบจำนวนคงเหลือและสถานะสินค้าได้ทันที',
  'รับเข้า เบิกออก พร้อมบันทึกประวัติทุกครั้ง',
  'กำหนดสิทธิ์ผู้ดูแลระบบและพนักงานอย่างชัดเจน',
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  let currentUser = null;
  try {
    currentUser = await getCurrentUser();
  } catch {
    // ฐานข้อมูลยังไม่พร้อม: ยังแสดงฟอร์มเพื่อไม่ให้หน้า login พังทั้งหน้า
  }

  if (currentUser) {
    redirect('/dashboard');
  }

  const { next } = await searchParams;
  const nextPath = safeInternalPath(next ?? null, '/dashboard');
  const year = new Date().getFullYear() + 543;

  return (
    <div className="login-shell grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="login-aside relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <Brand inverted />

        <div className="max-w-md space-y-5">
          <h1 className="text-3xl font-semibold leading-snug tracking-tight">
            จัดการสต๊อกอุปกรณ์สำนักงาน
            <br />
            ให้เป็นเรื่องง่าย
          </h1>
          <p className="text-sm leading-relaxed text-white/75">
            ตรวจสอบจำนวนคงเหลือ รับเข้า เบิกออก และดูประวัติการเคลื่อนไหวได้ในที่เดียว
            สำหรับทีม Thai Inter Flying
          </p>
          <ul className="space-y-3 pt-2 text-sm text-white/85">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-white/70" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">
          © {year} Thai Inter Flying · TIF Stock
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-background/95 p-6 shadow-xl backdrop-blur sm:p-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
          <div className="lg:hidden">
            <Brand />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">เข้าสู่ระบบ</h2>
            <p className="text-sm text-muted-foreground">
              ใช้บัญชีที่ผู้ดูแลระบบสร้างให้เท่านั้น
            </p>
          </div>

          <LoginForm nextPath={nextPath} />

          <p className="text-center text-xs text-muted-foreground">
            หากไม่มีบัญชีหรือลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ
          </p>
        </div>
      </main>
    </div>
  );
}
