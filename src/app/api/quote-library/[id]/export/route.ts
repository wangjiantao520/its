import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { dataToWorkbookBuffer } from '@/lib/quote-library-server-export';
import type { QuoteData } from '@/lib/quote-library-types';

interface Row extends Record<string, unknown> {
  id: string | number | bigint;
  title: string;
  client_name?: string | null;
  project_name?: string | null;
  quote_data: QuoteData | string;
  is_published: boolean;
}

type RouteContext = { params: Promise<{ id: string }> };

function idFrom(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const id = idFrom((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的资料库ID' }, { status: 400 });
    const database = getDatabase();
    const result = await database.query<Row>(
      `SELECT id, title, client_name, project_name, quote_data, is_published FROM quote_library WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ success: false, error: '报价资料不存在' }, { status: 404 });
    if (auth.session.role !== 'admin' && !row.is_published) {
      return NextResponse.json({ success: false, error: '该报价资料未发布' }, { status: 403 });
    }
    const quoteData: QuoteData = typeof row.quote_data === 'string'
      ? (JSON.parse(row.quote_data) as QuoteData)
      : row.quote_data;
    const buffer = dataToWorkbookBuffer(quoteData);
    const filename = `${row.client_name ?? '报价资料'}-${row.project_name ?? row.title}.xlsx`
      .replace(/[\\/:*?"<>|]/g, '_');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('导出报价资料失败:', error);
    return NextResponse.json({ success: false, error: '导出报价资料失败' }, { status: 500 });
  }
}