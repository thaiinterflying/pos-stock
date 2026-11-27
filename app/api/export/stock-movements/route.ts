import { parseBangkokDayEndExclusive, parseBangkokDayStart } from '@/lib/date-range';
import { formatBangkokFilenameStamp } from '@/lib/format';
import { isMovementTypeName } from '@/lib/stock';
import { getCurrentUser } from '@/server/auth/session';
import { buildStockMovementsCsv } from '@/server/lib/csv';
import { buildStockMovementsXlsx } from '@/server/lib/xlsx';
import { listStockMovementsForExport } from '@/server/queries/stock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new Response('กรุณาเข้าสู่ระบบใหม่', { status: 401 });
    }

    // Export เป็นสิทธิ์ของ Admin เท่านั้น (ตรวจฝั่ง server)
    if (user.role !== 'ADMIN') {
      return new Response('เฉพาะผู้ดูแลระบบเท่านั้น', { status: 403 });
    }

    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
    const typeParam = url.searchParams.get('type') ?? undefined;
    const type = isMovementTypeName(typeParam) ? typeParam : undefined;
    const from = parseBangkokDayStart(url.searchParams.get('from'));
    const toExclusive = parseBangkokDayEndExclusive(url.searchParams.get('to'));

    const items = await listStockMovementsForExport({
      q: q || undefined,
      type,
      from: from ?? undefined,
      toExclusive: toExclusive ?? undefined,
    });

    const stamp = formatBangkokFilenameStamp();

    if (format === 'xlsx') {
      const workbook = await buildStockMovementsXlsx(items);

      return new Response(workbook, {
        status: 200,
        headers: {
          'Content-Type': XLSX_CONTENT_TYPE,
          'Content-Disposition': `attachment; filename="tif-stock-movements-${stamp}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const csv = buildStockMovementsCsv(items);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tif-stock-movements-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('ไม่สามารถสร้างไฟล์ Export ได้ กรุณาลองใหม่', { status: 500 });
  }
}
