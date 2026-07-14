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
    allowedActions: ['submit_review', 'approve', 'archive'],
    nextStatus: { submit_review: 'pending_review', approve: 'approved', archive: 'archived' }
  },
  pending_review: {
    allowedActions: ['approve', 'reject'],
    nextStatus: { approve: 'approved', reject: 'draft' }
  },
  approved: {
    allowedActions: ['send', 'archive'],
    nextStatus: { send: 'sent', archive: 'archived' }
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

// 从三张表中查找报价
async function findQuoteById(quoteId: number): Promise<{ quote: any; source: string } | null> {
  // 1. 先查 engineering_quotes
  const [engRows] = await pool.execute(
    'SELECT id, status, quote_number, project_name, client_name FROM engineering_quotes WHERE id = ?',
    [quoteId]
  ) as [any[], any];
  if (engRows.length > 0) {
    return { quote: engRows[0], source: 'engineering' };
  }

  // 2. 再查 maintenance_quotes
  const [maintRows] = await pool.execute(
    'SELECT id, status, quote_number, project_name, client_name FROM maintenance_quotes WHERE id = ?',
    [quoteId]
  ) as [any[], any];
  if (maintRows.length > 0) {
    return { quote: maintRows[0], source: 'maintenance' };
  }

  // 3. 最后查 quotation_records（成员端）
  const [recRows] = await pool.execute(
    `SELECT id, status, 
      COALESCE(json_extract(quote_data, '$.quoteNumber'), 'Q' || id) as quote_number,
      COALESCE(project_name, json_extract(quote_data, '$.projectName'), '') as project_name,
      client_name
     FROM quotation_records WHERE id = ?`,
    [quoteId]
  ) as [any[], any];
  if (recRows.length > 0) {
    return { quote: recRows[0], source: 'quotation_records' };
  }

  return null;
}

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
    const { action, comment } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: '请提供操作类型 (action)' },
        { status: 400 }
      );
    }

    // 查找报价（从三张表中找）
    const found = await findQuoteById(quoteId);
    if (!found) {
      return NextResponse.json(
        { success: false, error: '报价不存在' },
        { status: 404 }
      );
    }

    const { quote, source } = found;
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

    // 确定表名和 quote_type
    let tableName: string;
    let quoteType: string;
    if (source === 'engineering') {
      tableName = 'engineering_quotes';
      quoteType = 'engineering';
    } else if (source === 'maintenance') {
      tableName = 'maintenance_quotes';
      quoteType = 'maintenance';
    } else {
      tableName = 'quotation_records';
      quoteType = 'maintenance';
    }

    // 更新状态
    await pool.execute(
      `UPDATE ${tableName} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [nextStatus, quoteId]
    );

    // 创建审核日志（如果表存在）
    try {
      await pool.execute(
        `INSERT INTO quote_audit_logs
         (quote_id, quote_type, action, from_status, to_status, comment, operator)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [quoteId, quoteType, action, currentStatus, nextStatus, comment || null, operator]
      );
    } catch (auditErr) {
      // 审计日志表不存在时忽略
      console.warn('写入审计日志失败:', auditErr);
    }

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

    const found = await findQuoteById(quoteId);
    if (!found) {
      return NextResponse.json(
        { success: false, error: '报价不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: quoteId,
        quoteNumber: found.quote.quote_number,
        status: found.quote.status,
        source: found.source
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
