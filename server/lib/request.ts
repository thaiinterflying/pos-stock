import { headers } from 'next/headers';

export async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get('x-forwarded-for');
  const first = forwardedFor?.split(',')[0]?.trim();
  return first || requestHeaders.get('x-real-ip') || null;
}

export async function getUserAgent(): Promise<string | null> {
  const requestHeaders = await headers();
  return requestHeaders.get('user-agent')?.slice(0, 255) ?? null;
}
