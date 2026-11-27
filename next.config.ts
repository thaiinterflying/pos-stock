import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

if (isProduction) {
  securityHeaders.push(
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    },
    {
      // CSP พื้นฐานสำหรับ production — ยังอนุญาต inline script/style ตามที่ Next ต้องใช้
      // (แนวทางยกระดับเป็น nonce-based CSP อยู่ใน docs/SECURITY.md)
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
  );
}

const nextConfig: NextConfig = {
  // ไม่เปิดเผย framework ที่ใช้
  poweredByHeader: false,

  // รูปสินค้าจำกัด 2 MB + overhead ของ multipart
  experimental: {
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },

  // Native / driver packages that must not be bundled by the server compiler.
  serverExternalPackages: ['@node-rs/argon2', 'ws', 'exceljs'],

  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
