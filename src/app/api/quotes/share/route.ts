import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';
import { getQuoteSummaries, parseQuoteIdentity } from '@/lib/quote-summary';

interface ShareRow {
  id: number;
  token: string;
  quote_id: number;
  quote_type: string;
  expires_at: string | null;
  view_count: number;
  is_active: number;
  created_at: string;
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      quoteId?: string;
      expiryDays?: number;
      expiresInDays?: number;
      maxViews?: number;
    };
    const parsed = body.quoteId ? parseQuoteIdentity(body.quoteId) : null;
    if (!parsed) {
      return NextResponse.json({ success: false, error: '无效的报价标识' }, { status: 400 });
    }

    const createdBy = auth.session.role === 'admin' ? undefined : String(auth.session.userId ?? -1);
    const quote = getQuoteSummaries(db, { source: parsed.source, createdBy })
      .find((item) => item.id === parsed.id);
    if (!quote) {
      return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    }

    const days = Math.min(365, Math.max(1, Number(body.expiryDays ?? body.expiresInDays) || 30));
    const maxViews = body.maxViews === undefined ? 0 : Number(body.maxViews);
    if (!Number.isInteger(maxViews) || maxViews < 0 || maxViews > 1_000_000) {
      return NextResponse.json({ success: false, error: '访问次数上限必须是有效的非负整数' }, { status: 400 });
    }
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const token = crypto.randomBytes(16).toString('hex');
    const result = db.prepare(`
      INSERT INTO quote_shares (token, quote_id, quote_type, expires_at, max_views)
      VALUES (?, ?, ?, ?, ?)
    `).run(token, parsed.id, parsed.source, expiresAt.toISOString(), maxViews);

    return NextResponse.json({
      success: true,
      data: {
        id: Number(result.lastInsertRowid),
        token,
        quoteId: quote.identity,
        quoteType: parsed.source,
        expiresAt: expiresAt.toISOString(),
        shareUrl: `/share/${token}`,
      },
    });
  } catch (error) {
    console.error('创建分享链接失败:', error);
    return NextResponse.json({ success: false, error: '创建分享链接失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));
  const allRows = db.prepare(`
    SELECT id, token, quote_id, quote_type, expires_at, view_count, is_active, created_at
    FROM quote_shares
    ORDER BY created_at DESC
  `).all() as ShareRow[];
  const allowedIdentities: Set<string> | null = auth.session.role === 'admin'
    ? null
    : new Set(getQuoteSummaries(db, { createdBy: String(auth.session.userId ?? -1) }).map((quote) => quote.identity));
  const visibleRows = allowedIdentities
    ? allRows.filter((row) => allowedIdentities.has(`${row.quote_type}:${row.quote_id}`))
    : allRows;
  const total = visibleRows.length;
  const rows = visibleRows.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      quoteIdentity: `${row.quote_type}:${row.quote_id}`,
      shareUrl: `/share/${row.token}`,
      isExpired: Boolean(row.expires_at && new Date(row.expires_at).getTime() <= Date.now()),
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}
