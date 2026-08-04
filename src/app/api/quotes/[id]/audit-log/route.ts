import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { asQuoteSource, canAccessQuote } from '@/lib/quote-access';

interface CountRow extends Record<string, unknown> { total: string | number }

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const quoteId = Number((await params).id);
    if (!Number.isSafeInteger(quoteId) || quoteId <= 0) return NextResponse.json({ success: false, error: '无效的报价ID' }, { status: 400 });
    const quoteType = asQuoteSource(request.nextUrl.searchParams.get('quoteType') || 'maintenance');
    if (!quoteType) return NextResponse.json({ success: false, error: '无效的报价类型' }, { status: 400 });
    const database = getDatabase();
    if (!await canAccessQuote(database, auth.session, quoteType, quoteId)) return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50));
    const rows = await database.query<Record<string, unknown>>(`
      SELECT id, quote_id, quote_type, action, from_status, to_status, comment, operator, created_at
      FROM quote_audit_logs WHERE quote_id=$1 AND quote_type=$2
      ORDER BY created_at DESC LIMIT $3 OFFSET $4
    `, [quoteId, quoteType, limit, (page - 1) * limit]);
    const count = await database.query<CountRow>('SELECT COUNT(*)::text AS total FROM quote_audit_logs WHERE quote_id=$1 AND quote_type=$2', [quoteId, quoteType]);
    const total = Number(count.rows[0]?.total ?? 0);
    return NextResponse.json({ success: true, data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    console.error('获取审核日志失败:', error);
    return NextResponse.json({ success: false, error: '获取审核日志失败' }, { status: 500 });
  }
}
