import { eq } from 'drizzle-orm';

import { getCurrentUser } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { products } from '@/server/db/schema';
import { getObjectBytes } from '@/server/lib/object-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): Response {
  return new Response('ไม่พบรูปภาพ', { status: 404 });
}

/**
 * เสิร์ฟรูปสินค้าจาก bucket private
 * - ต้อง login ก่อน (Admin และ Staff ดูได้)
 * - URL มี ?v=<image_updated_at> เพื่อให้เปลี่ยนรูปแล้ว cache ไม่ค้าง
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response('กรุณาเข้าสู่ระบบใหม่', { status: 401 });
    }

    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return notFound();
    }

    const [row] = await getDb()
      .select({ imageKey: products.imageKey })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!row?.imageKey) {
      return notFound();
    }

    const object = await getObjectBytes(row.imageKey);
    if (!object) {
      return notFound();
    }

    return new Response(object.bytes, {
      status: 200,
      headers: {
        'Content-Type': object.contentType,
        'Content-Length': String(object.bytes.byteLength),
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่', { status: 500 });
  }
}
