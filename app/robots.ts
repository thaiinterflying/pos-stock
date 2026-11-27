import type { MetadataRoute } from 'next';

/** ระบบภายในองค์กร — ไม่ต้องการให้ search engine จัดเก็บ */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
