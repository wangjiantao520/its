import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';
import {
  getQuoteSummaries,
  parseQuoteIdentity,
  updateQuoteStatus,
} from '@/lib/quote-summary';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const STATUS_FLOW: Record<string, Record<string, string>> = {
  draft: { submit_review: 'pending_review', approve: 'approved', archive: 'archived' },
  submitted: { approve: 'approved', reject: 'draft' },
  pending_review: { approve: 'approved', reject: 'draft' },
  approved: { send: 'sent', archive: 'archived' },
  sent: { archive: 'archived' },
  rejected: { submit_review: 'pending_review', archive: 'archived' },
  archived: {},
};

function accessibleQuote(id: string, role: string, userId?: number) {
  const parsed = parseQuoteIdentity(id);
  if (!parsed) return null;
  const createdBy = role === 'admin' ? undefined : String(userId ?? -1);
  return getQuoteSummaries(db, { source: parsed.source, createdBy })
    .find((quote) => quote.id === parsed.id) || null;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const parsed = parseQuoteIdentity(id);
    if (!parsed) {
      return NextResponse.json({ success: false, error: '无效的报价标识' }, { status: 400 });
    }
    const quote = accessibleQuote(id, auth.session.role, auth.session.userId);
    if (!quote) {
      return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    }

    const body = (await request.json()) as { action?: string; comment?: string };
    const action = body.action || '';
    const nextStatus = STATUS_FLOW[quote.status]?.[action];
    if (!nextStatus) {
      return NextResponse.json(
        {
          success: false,
          error: `当前状态不允许执行该操作`,
          data: { currentStatus: quote.status, allowedActions: Object.keys(STATUS_FLOW[quote.status] || {}) },
        },
        { status: 400 },
      );
    }

    updateQuoteStatus(db, id, nextStatus);
    db.prepare(`
      INSERT INTO quote_audit_logs
        (quote_id, quote_type, action, from_status, to_status, comment, operator)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      parsed.id,
      parsed.source,
      action,
      quote.status,
      nextStatus,
      body.comment?.trim() || null,
      auth.session.name || auth.session.username || auth.session.role,
    );

    return NextResponse.json({
      success: true,
      data: {
        id,
        quoteNumber: quote.quoteNumber,
        fromStatus: quote.status,
        toStatus: nextStatus,
        action,
      },
    });
  } catch (error) {
    console.error('更新报价状态失败:', error);
    return NextResponse.json({ success: false, error: '更新报价状态失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const quote = accessibleQuote(id, auth.session.role, auth.session.userId);
  if (!quote) {
    return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: { id, quoteNumber: quote.quoteNumber, status: quote.status, source: quote.source },
  });
}
