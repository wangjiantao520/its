import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySession } from '@/lib/auth';

// 认证中间件
function requireAuth(request: NextRequest): { authorized: boolean; session?: { role: string }; response?: NextResponse } {
  const session = verifySession(request);
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    };
  }
  return { authorized: true, session };
}

// 状态流转定义
const STATUS_FLOW: Record<string, { allowedActions: string[]; nextStatus: Record<string, string> }> = {
  draft: {
    allowedActions: ['submit_review'],
    nextStatus: { submit_review: 'pending_review' }
  },
  pending_review: {
    allowedActions: ['approve', 'reject'],
    nextStatus: { approve: 'approved', reject: 'draft' }
  },
  approved: {
    allowedActions: ['send'],
    nextStatus: { send: 'sent' }
  },
  sent: {
    allowedActions: ['archive'],
    nextStatus: { archive: 'archived' }
  },
  archived: {
    allowedActions: [],
    nextStatus: {}
  }
};

// PUT - 更新报价状态
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { id } = await params;
    const quoteId = parseInt(id);
    if (isNaN(quoteId)) {
      return NextResponse.json(
        { success: false, error: '无效的报价ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, comment, quoteType } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: '请提供操作类型 (action)' },
        { status: 400 }
      );
    }

    // 确定报价类型和表名
    const validQuoteTypes = ['maintenance', 'engineering'];
    const tableName = quoteType === 'engineering' ? 'engineering_quotes' : 'maintenance_quotes';

    // 获取当前报价状态
    const [rows] = await pool.query(
      `SELECT id, status, quote_number FROM ${tableName} WHERE id = ?`,
      [quoteId]
    ) as [any[], any];

    const quote = rows[0];
    if (!quote) {
      return NextResponse.json(
        { success: false, error: '报价不存在' },
        { status: 404 }
      );
    }

    const currentStatus = quote.status;

    // 验证状态流转
    const flow = STATUS_FLOW[currentStatus];
    if (!flow || !flow.allowedActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: `当前状态 "${currentStatus}" 不允许执行 "${action}" 操作`,
          currentStatus,
          allowedActions: flow?.allowedActions || []
        },
        { status: 400 }
      );
    }

    const nextStatus = flow.nextStatus[action];

    // 获取操作人
    const operator = auth.session?.role === 'admin' ? 'admin' : 'its_member';

    // 更新状态
    await pool.query(
      `UPDATE ${tableName} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [nextStatus, quoteId]
    );

    // 创建审核日志
    await pool.query(
      `INSERT INTO quote_audit_logs
       (quote_id, quote_type, action, from_status, to_status, comment, operator)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [quoteId, quoteType || (tableName === 'engineering_quotes' ? 'engineering' : 'maintenance'), action, currentStatus, nextStatus, comment || null, operator]
    );

    return NextResponse.json({
      success: true,
      data: {
        id: quoteId,
        quoteNumber: quote.quote_number,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        action
      }
    });
  } catch (error) {
    console.error('更新报价状态失败:', error);
    return NextResponse.json(
      { success: false, error: '更新报价状态失败' },
      { status: 500 }
    );
  }
}

// GET - 获取报价状态
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { id } = await params;
    const quoteId = parseInt(id);
    if (isNaN(quoteId)) {
      return NextResponse.json(
        { success: false, error: '无效的报价ID' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const quoteType = searchParams.get('quoteType') || 'maintenance';
    const tableName = quoteType === 'engineering' ? 'engineering_quotes' : 'maintenance_quotes';

    const [rows] = await pool.query(
      `SELECT id, quote_number, status, updated_at FROM ${tableName} WHERE id = ?`,
      [quoteId]
    ) as [any[], any];

    const quote = rows[0];
    if (!quote) {
      return NextResponse.json(
        { success: false, error: '报价不存在' },
        { status: 404 }
      );
    }

    const flow = STATUS_FLOW[quote.status];

    return NextResponse.json({
      success: true,
      data: {
        id: quote.id,
        quoteNumber: quote.quote_number,
        status: quote.status,
        allowedActions: flow?.allowedActions || [],
        updatedAt: quote.updated_at
      }
    });
  } catch (error) {
    console.error('获取报价状态失败:', error);
    return NextResponse.json(
      { success: false, error: '获取报价状态失败' },
      { status: 500 }
    );
  }
}
