import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/constants';

const PUBLIC_PATHS = ['/login', '/api/health', '/robots.txt', '/icon.svg', '/favicon.ico'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * ชั้นแรกแบบ optimistic: ถ้าไม่มี cookie เลยให้ไปหน้า login
 * (การตรวจ session จริงกับ DB อยู่ใน requireUser/requireAdmin ของทุกหน้า)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (hasSessionCookie || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';

  if (pathname !== '/') {
    loginUrl.searchParams.set('next', pathname);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  // images/ เป็น static asset ของ public (เช่น พื้นหลังหน้า login) — ไม่ต้องผ่าน auth
  matcher: ['/((?!api/health|images/|_next/static|_next/image|favicon.ico).*)'],
};
