import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { getQuoteSummaries, parseQuoteIdentity } from '@/lib/quote-summary';

interface IdRow extends Record<string, unknown> { id: string | number | bigint }
interface InsertedShareRow extends IdRow { expires_at: Date | string }
interface ShareRow extends Record<string, unknown> { id: string | number | bigint; token: string; quote_id: string | number | bigint; quote_type: string; expires_at: Date | string | null; view_count: number; is_active: boolean; password: string | null; remark: string | null; max_views: number; created_at: Date | string }
interface CountRow extends Record<string, unknown> { total: string | number }
function objectBody(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

function parseShareQuoteId(value: unknown): { source: 'engineering' | 'maintenance' | 'quotation'; id: number } | null {
  if (typeof value !== 'string') return null;
  const parsed = parseQuoteIdentity(value);
  if (parsed) return parsed;
  // 兼容纯数字 id：工程报价默认 source
  const numeric = /^\d+$/.exec(value);
  if (!numeric) return null;
  const id = Number(numeric[0]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { source: 'engineering' as const, id };
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const body = objectBody(await request.json());
    const parsed = parseShareQuoteId(body.quoteId);
    if (!parsed) return NextResponse.json({ success: false, error: '无效的报价标识' }, { status: 400 });
    const database = getDatabase();
    const createdBy = auth.session.role === 'admin' ? undefined : String(auth.session.userId ?? -1);
    const quote = (await getQuoteSummaries(database, { source: parsed.source, createdBy })).find((item) => item.id === parsed.id);
    if (!quote) return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    const daysInput = Number(body.expiryDays ?? body.expiresInDays ?? 30);
    if (!Number.isInteger(daysInput) || daysInput < 1 || daysInput > 365) return NextResponse.json({ success: false, error: '有效期必须为1到365天' }, { status: 400 });
    const maxViews = body.maxViews === undefined ? 0 : Number(body.maxViews);
    if (!Number.isInteger(maxViews) || maxViews < 0 || maxViews > 1_000_000) return NextResponse.json({ success: false, error: '访问次数上限必须是有效的非负整数' }, { status: 400 });
    const password = typeof body.password === 'string' && body.password.length > 0 ? body.password : null;
    const remark = typeof body.remark === 'string' && body.remark.length > 0 ? body.remark : null;
    const token = crypto.randomBytes(16).toString('hex');
    const inserted = await database.query<InsertedShareRow>(`
      INSERT INTO quote_shares (token, quote_id, quote_type, expires_at, max_views, password, remark)
      VALUES ($1,$2,$3,CURRENT_TIMESTAMP + ($4 * INTERVAL '1 day'),$5,$6,$7) RETURNING id, expires_at
    `, [token, parsed.id, parsed.source, daysInput, maxViews, password, remark]);
    const insertedShare = inserted.rows[0];
    if (!insertedShare) throw new Error('分享链接未写入');
    const expiresAt = insertedShare.expires_at instanceof Date ? insertedShare.expires_at.toISOString() : insertedShare.expires_at;
    return NextResponse.json({ success: true, data: { id: String(insertedShare.id), token, quoteId: quote.identity, quoteType: parsed.source, expiresAt, hasPassword: Boolean(password), shareUrl: `/share/${token}` } });
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
    const quoteIdParam = request.nextUrl.searchParams.get('quoteId');
    const quoteFilter = quoteIdParam ? parseShareQuoteId(quoteIdParam) : null;
    const owner = auth.session.role === 'admin' ? null : String(auth.session.userId ?? -1);
    const database = getDatabase();
    const visibility = `
      WHERE $1::text IS NULL OR
        (share.quote_type='engineering' AND EXISTS (SELECT 1 FROM engineering_quotes quote WHERE quote.id=share.quote_id AND quote.created_by=$1)) OR
        (share.quote_type='maintenance' AND EXISTS (SELECT 1 FROM maintenance_quotes quote WHERE quote.id=share.quote_id AND quote.created_by=$1)) OR
        (share.quote_type='quotation' AND EXISTS (SELECT 1 FROM quotation_records quote WHERE quote.id=share.quote_id AND quote.user_id::text=$1))
    `;
    const conditions = [visibility];
    const params: unknown[] = [owner];
    if (quoteFilter) {
      conditions.push(`share.quote_type = $${params.length + 1} AND share.quote_id = $${params.length + 2}`);
      params.push(quoteFilter.source, quoteFilter.id);
    }
    const whereClause = conditions.join(' AND ');
    const count = await database.query<CountRow>(`SELECT COUNT(*)::text AS total FROM quote_shares share ${whereClause}`, params);
    const total = Number(count.rows[0]?.total ?? 0);
    const rows = await database.query<ShareRow>(`
      SELECT share.id, share.token, share.quote_id, share.quote_type, share.expires_at,
             share.view_count, share.is_active, share.password, share.remark, share.max_views, share.created_at
      FROM quote_shares share
      ${whereClause}
      ORDER BY share.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, (page - 1) * limit]);
    const now = Date.now();
    const data = rows.rows.map((row) => {
      const expiresAt = row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at;
      const isExpired = Boolean(expiresAt && new Date(expiresAt).getTime() <= now);
      return {
        id: String(row.id),
        token: row.token,
        quoteId: `${row.quote_type}:${row.quote_id}`,
        quoteType: row.quote_type,
        expiresAt,
        isExpired,
        isActive: Boolean(row.is_active),
        hasPassword: Boolean(row.password),
        password: row.password,
        remark: row.remark,
        maxViews: Number(row.max_views),
        viewCount: Number(row.view_count),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        shareUrl: `/share/${row.token}`,
      };
    });
    return NextResponse.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error('获取分享链接失败:', error);
    return NextResponse.json({ success: false, error: '获取分享链接失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const body = objectBody(await request.json());
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ success: false, error: '无效的分享ID' }, { status: 400 });
    const database = getDatabase();
    const owner = auth.session.role === 'admin' ? null : String(auth.session.userId ?? -1);
    const visibility = `
      WHERE share.id = $2 AND ($1::text IS NULL OR
        (share.quote_type='engineering' AND EXISTS (SELECT 1 FROM engineering_quotes quote WHERE quote.id=share.quote_id AND quote.created_by=$1)) OR
        (share.quote_type='maintenance' AND EXISTS (SELECT 1 FROM maintenance_quotes quote WHERE quote.id=share.quote_id AND quote.created_by=$1)) OR
        (share.quote_type='quotation' AND EXISTS (SELECT 1 FROM quotation_records quote WHERE quote.id=share.quote_id AND quote.user_id::text=$1)))
    `;
    const updated = await database.query<IdRow>(`
      UPDATE quote_shares share SET is_active = false, updated_at = CURRENT_TIMESTAMP
      ${visibility} RETURNING share.id
    `, [owner, id]);
    if (!updated.rows[0]) return NextResponse.json({ success: false, error: '分享链接不存在或无权操作' }, { status: 404 });
    return NextResponse.json({ success: true, message: '分享链接已停用' });
  } catch (error) {
    console.error('停用分享链接失败:', error);
    return NextResponse.json({ success: false, error: '停用分享链接失败' }, { status: 500 });
  }
}
