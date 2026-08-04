import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as unknown;
    const ids = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>).ids : undefined;
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ success: false, error: '请选择至少一条报价单' }, { status: 400 });
    if (ids.length > 100) return NextResponse.json({ success: false, error: '单次批量导出不能超过100条' }, { status: 400 });
    const normalized = ids.map(Number);
    if (!normalized.every((id) => Number.isSafeInteger(id) && id > 0)) return NextResponse.json({ success: false, error: '报价ID格式无效' }, { status: 400 });
    const placeholders = normalized.map((_, index) => `$${index + 1}`).join(',');
    const values: unknown[] = [...normalized];
    const owner = auth.session.role === 'admin' ? '' : ` AND created_by = $${values.length + 1}`;
    if (owner) values.push(String(auth.session.userId ?? -1));
    const rows = await getDatabase().query<Record<string, unknown>>(
      `SELECT * FROM engineering_quotes WHERE id IN (${placeholders})${owner} ORDER BY created_at DESC`, values,
    );
    return NextResponse.json({ success: true, data: rows.rows });
  } catch (error) {
    console.error('批量获取报价单失败:', error);
    return NextResponse.json({ success: false, error: '批量获取报价单失败' }, { status: 500 });
  }
}
