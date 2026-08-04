import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';
import { parseQuoteIdentity, type QuoteSource } from '@/lib/quote-summary';

type RouteParams = { params: Promise<{ id: string }> };
interface LockedQuoteRow extends Record<string, unknown> { id: string | number | bigint; quote_number: string; status: string }
interface IdRow extends Record<string, unknown> { id: string | number | bigint }
const TABLES: Record<QuoteSource, 'engineering_quotes' | 'maintenance_quotes' | 'quotation_records'> = {
  engineering: 'engineering_quotes', maintenance: 'maintenance_quotes', quotation: 'quotation_records',
};
const STATUS_FLOW: Record<string, Record<string, string>> = {
  draft: { submit_review: 'pending_review', approve: 'approved', archive: 'archived' },
  submitted: { approve: 'approved', reject: 'draft' }, pending_review: { approve: 'approved', reject: 'draft' },
  approved: { send: 'sent', archive: 'archived' }, sent: { archive: 'archived' },
  rejected: { submit_review: 'pending_review', archive: 'archived' }, archived: {},
};

async function lockAccessibleQuote(
  database: DatabaseClient,
  source: QuoteSource,
  quoteId: number,
  role: string,
  userId?: number,
): Promise<LockedQuoteRow | null> {
  const ownerColumn = source === 'quotation' ? 'user_id::text' : 'created_by';
  const quoteNumber = source === 'quotation' ? "'QUOTE-' || id::text" : 'quote_number';
  const values: unknown[] = [quoteId];
  const owner = role === 'admin' ? '' : ` AND ${ownerColumn}=$2`;
  if (owner) values.push(String(userId ?? -1));
  const result = await database.query<LockedQuoteRow>(`
    SELECT id, ${quoteNumber} AS quote_number, status
    FROM ${TABLES[source]}
    WHERE id=$1${owner}
    FOR UPDATE
  `, values);
  return result.rows[0] ?? null;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const id = (await params).id;
    const parsed = parseQuoteIdentity(id);
    if (!parsed) return NextResponse.json({ success: false, error: '无效的报价标识' }, { status: 400 });
    const rawBody = await request.json() as unknown;
    const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody as Record<string, unknown> : {};
    const action = typeof body.action === 'string' ? body.action : '';
    const database = getDatabase();
    const outcome = await database.transaction(async (client) => {
      const quote = await lockAccessibleQuote(client, parsed.source, parsed.id, auth.session.role, auth.session.userId);
      if (!quote) return { kind: 'missing' as const };
      const nextStatus = STATUS_FLOW[quote.status]?.[action];
      if (!nextStatus) return { kind: 'invalid' as const, status: quote.status, allowedActions: Object.keys(STATUS_FLOW[quote.status] ?? {}) };
      const updated = await client.query<IdRow>(`
        UPDATE ${TABLES[parsed.source]}
        SET status=$1, updated_at=CURRENT_TIMESTAMP
        WHERE id=$2 AND status=$3
        RETURNING id
      `, [nextStatus, parsed.id, quote.status]);
      if (!updated.rows[0]) return { kind: 'conflict' as const };
      await client.query<IdRow>(`
        INSERT INTO quote_audit_logs (quote_id, quote_type, action, from_status, to_status, comment, operator)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
      `, [parsed.id, parsed.source, action, quote.status, nextStatus,
        typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim() : null,
        auth.session.name || auth.session.username || auth.session.role]);
      return { kind: 'updated' as const, quote, nextStatus };
    });
    if (outcome.kind === 'missing') return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    if (outcome.kind === 'conflict') return NextResponse.json({ success: false, error: '报价状态已被其他操作更新，请刷新后重试' }, { status: 409 });
    if (outcome.kind === 'invalid') return NextResponse.json({ success: false, error: '当前状态不允许执行该操作', data: { currentStatus: outcome.status, allowedActions: outcome.allowedActions } }, { status: 400 });
    return NextResponse.json({ success: true, data: { id, quoteNumber: outcome.quote.quote_number, fromStatus: outcome.quote.status, toStatus: outcome.nextStatus, action } });
  } catch (error) {
    console.error('更新报价状态失败:', error);
    return NextResponse.json({ success: false, error: '更新报价状态失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const id = (await params).id;
  const parsed = parseQuoteIdentity(id);
  if (!parsed) return NextResponse.json({ success: false, error: '无效的报价标识' }, { status: 400 });
  const outcome = await getDatabase().transaction(async (client) => lockAccessibleQuote(client, parsed.source, parsed.id, auth.session.role, auth.session.userId));
  if (!outcome) return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
  return NextResponse.json({ success: true, data: { id, quoteNumber: outcome.quote_number, status: outcome.status, source: parsed.source } });
}
