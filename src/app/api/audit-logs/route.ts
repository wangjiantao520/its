import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

interface CountRow extends Record<string, unknown> { total: string | number }
const ACTIONS = new Set(['create', 'submit_review', 'approve', 'reject', 'send', 'archive', 'update']);

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20));
    const conditions: string[] = []; const values: unknown[] = [];
    const add = (sql: string, value: unknown) => { values.push(value); conditions.push(sql.replace('$n', `$${values.length}`)); };
    const quoteId = request.nextUrl.searchParams.get('quoteId');
    if (quoteId) {
      const id = Number(quoteId); if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ success: false, error: '无效的报价ID' }, { status: 400 });
      add('audit.quote_id=$n', id);
    }
    const quoteType = request.nextUrl.searchParams.get('quoteType');
    if (quoteType) {
      if (!['maintenance', 'engineering', 'quotation'].includes(quoteType)) return NextResponse.json({ success: false, error: '无效的报价类型' }, { status: 400 });
      add('audit.quote_type=$n', quoteType);
    }
    const action = request.nextUrl.searchParams.get('action');
    if (action) { if (!ACTIONS.has(action)) return NextResponse.json({ success: false, error: '无效的审核动作' }, { status: 400 }); add('audit.action=$n', action); }
    const startDate = request.nextUrl.searchParams.get('startDate'); if (startDate) add('audit.created_at >= $n::timestamptz', startDate);
    const endDate = request.nextUrl.searchParams.get('endDate'); if (endDate) add("audit.created_at < ($n::date + INTERVAL '1 day')", endDate);
    const operator = request.nextUrl.searchParams.get('operator'); if (operator) add('audit.operator=$n', operator);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const database = getDatabase();
    const rows = await database.query<Record<string, unknown>>(`
      SELECT audit.id, audit.quote_id, audit.quote_type, audit.action, audit.from_status,
             audit.to_status, audit.comment, audit.operator, audit.created_at,
             COALESCE(engineering.quote_number, maintenance.quote_number, 'QUOTE-' || quotation.id::text) AS "quoteNumber"
      FROM quote_audit_logs audit
      LEFT JOIN engineering_quotes engineering ON audit.quote_type='engineering' AND engineering.id=audit.quote_id
      LEFT JOIN maintenance_quotes maintenance ON audit.quote_type='maintenance' AND maintenance.id=audit.quote_id
      LEFT JOIN quotation_records quotation ON audit.quote_type='quotation' AND quotation.id=audit.quote_id
      ${where} ORDER BY audit.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, [...values, limit, (page - 1) * limit]);
    const count = await database.query<CountRow>(`SELECT COUNT(*)::text AS total FROM quote_audit_logs audit ${where}`, values);
    const total = Number(count.rows[0]?.total ?? 0);
    return NextResponse.json({ success: true, data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    console.error('获取审核日志列表失败:', error);
    return NextResponse.json({ success: false, error: '获取审核日志列表失败' }, { status: 500 });
  }
}
