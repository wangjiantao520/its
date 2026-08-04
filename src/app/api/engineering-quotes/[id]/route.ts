import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

type RouteContext = { params: Promise<{ id: string }> };
interface QuoteRow extends Record<string, unknown> { id: string | number | bigint; status: string; created_by: string | null }

function quoteId(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const id = quoteId((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的报价ID' }, { status: 400 });
    const values: unknown[] = [id];
    const owner = auth.session.role === 'admin' ? '' : ' AND created_by = $2';
    if (owner) values.push(String(auth.session.userId ?? -1));
    const result = await getDatabase().query<QuoteRow>(`SELECT * FROM engineering_quotes WHERE id = $1${owner}`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: '报价单不存在或无权访问' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('获取工程报价详情失败:', error);
    return NextResponse.json({ success: false, error: '获取工程报价详情失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const id = quoteId((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的报价ID' }, { status: 400 });
    const body = await request.json() as unknown;
    const status = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>).status : undefined;
    const validStatuses = ['draft', 'submitted', 'approved', 'rejected'];
    if (typeof status !== 'string' || !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: '无效的状态值，可选值：draft, submitted, approved, rejected' }, { status: 400 });
    }
    const values: unknown[] = [status, id];
    let owner = '';
    if (auth.session.role !== 'admin') { values.push(String(auth.session.userId ?? -1)); owner = ' AND created_by = $3'; }
    const updated = await getDatabase().query<QuoteRow>(`
      UPDATE engineering_quotes SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2${owner} RETURNING id, status, created_by
    `, values);
    if (!updated.rows[0]) return NextResponse.json({ success: false, error: '报价单不存在或无权访问' }, { status: 404 });
    return NextResponse.json({ success: true, data: { id, status } });
  } catch (error) {
    console.error('变更报价状态失败:', error);
    return NextResponse.json({ success: false, error: '变更报价状态失败' }, { status: 500 });
  }
}
