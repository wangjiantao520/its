import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { getQuoteSummaries, parseQuoteIdentity } from '@/lib/quote-summary';

interface IdRow extends Record<string, unknown> { id: string | number | bigint }
interface InsertedShareRow extends IdRow { expires_at: Date | string }
interface ShareRow extends Record<string, unknown> { id: string | number | bigint; token: string; quote_id: string | number | bigint; quote_type: string; expires_at: Date | string | null; view_count: number; is_active: boolean; created_at: Date | string }
interface CountRow extends Record<string, unknown> { total: string | number }
function objectBody(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const body = objectBody(await request.json());
    const parsed = typeof body.quoteId === 'string' ? parseQuoteIdentity(body.quoteId) : null;
    if (!parsed) return NextResponse.json({ success: false, error: '无效的报价标识' }, { status: 400 });
    const database = getDatabase();
    const createdBy = auth.session.role === 'admin' ? undefined : String(auth.session.userId ?? -1);
    const quote = (await getQuoteSummaries(database, { source: parsed.source, createdBy })).find((item) => item.id === parsed.id);
    if (!quote) return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    const daysInput = Number(body.expiryDays ?? body.expiresInDays ?? 30);
    if (!Number.isInteger(daysInput) || daysInput < 1 || daysInput > 365) return NextResponse.json({ success: false, error: '有效期必须为1到365天' }, { status: 400 });
    const maxViews = body.maxViews === undefined ? 0 : Number(body.maxViews);
    if (!Number.isInteger(maxViews) || maxViews < 0 || maxViews > 1_000_000) return NextResponse.json({ success: false, error: '访问次数上限必须是有效的非负整数' }, { status: 400 });
    const token = crypto.randomBytes(16).toString('hex');
    const inserted = await database.query<InsertedShareRow>(`
      INSERT INTO quote_shares (token, quote_id, quote_type, expires_at, max_views)
      VALUES ($1,$2,$3,CURRENT_TIMESTAMP + ($4 * INTERVAL '1 day'),$5) RETURNING id, expires_at
    `, [token, parsed.id, parsed.source, daysInput, maxViews]);
    const insertedShare = inserted.rows[0];
    if (!insertedShare) throw new Error('分享链接未写入');
    const expiresAt = insertedShare.expires_at instanceof Date ? insertedShare.expires_at.toISOString() : insertedShare.expires_at;
    return NextResponse.json({ success: true, data: { id: String(insertedShare.id), token, quoteId: quote.identity, quoteType: parsed.source, expiresAt, shareUrl: `/share/${token}` } });
  } catch (error) {
    console.error('创建分享链接失败:', error);
    return NextResponse.json({ success: false, error: '创建分享链接失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20));
    const owner = auth.session.role === 'admin' ? null : String(auth.session.userId ?? -1);
    const database = getDatabase();
    const visibility = `
      WHERE $1::text IS NULL OR
        (share.quote_type='engineering' AND EXISTS (SELECT 1 FROM engineering_quotes quote WHERE quote.id=share.quote_id AND quote.created_by=$1)) OR
        (share.quote_type='maintenance' AND EXISTS (SELECT 1 FROM maintenance_quotes quote WHERE quote.id=share.quote_id AND quote.created_by=$1)) OR
        (share.quote_type='quotation' AND EXISTS (SELECT 1 FROM quotation_records quote WHERE quote.id=share.quote_id AND quote.user_id::text=$1))
    `;
    const count = await database.query<CountRow>(`SELECT COUNT(*)::text AS total FROM quote_shares share ${visibility}`, [owner]);
    const total = Number(count.rows[0]?.total ?? 0);
    const rows = await database.query<ShareRow>(`
      SELECT share.id, share.token, share.quote_id, share.quote_type, share.expires_at,
             share.view_count, share.is_active, share.created_at
      FROM quote_shares share
      ${visibility}
      ORDER BY share.created_at DESC LIMIT $2 OFFSET $3
    `, [owner, limit, (page - 1) * limit]);
    const data = rows.rows.map((row) => ({ ...row, id: String(row.id), quoteIdentity: `${row.quote_type}:${row.quote_id}`, shareUrl: `/share/${row.token}`, isExpired: Boolean(row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) }));
    return NextResponse.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error('获取分享链接失败:', error);
    return NextResponse.json({ success: false, error: '获取分享链接失败' }, { status: 500 });
  }
}
