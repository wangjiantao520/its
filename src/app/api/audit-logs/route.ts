import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySession } from '@/lib/auth';

// 认证中间件（仅限管理员）
function requireAdmin(request: NextRequest): { authorized: boolean; response?: NextResponse } {
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
  if (session.role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: '需要管理员权限' },
        { status: 403 }
      )
    };
  }
  return { authorized: true };
}

// GET - 获取审核日志列表（管理员）
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 100);
    const offset = (page - 1) * limit;

    // 筛选参数
    const quoteId = searchParams.get('quoteId');
    const quoteType = searchParams.get('quoteType');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const operator = searchParams.get('operator');

    // 构建WHERE条件
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (quoteId) {
      conditions.push('quote_id = ?');
      queryParams.push(parseInt(quoteId));
    }
    if (quoteType && ['maintenance', 'engineering'].includes(quoteType)) {
      conditions.push('quote_type = ?');
      queryParams.push(quoteType);
    }
    if (action && ['create', 'submit_review', 'approve', 'reject', 'send', 'archive', 'update'].includes(action)) {
      conditions.push('action = ?');
      queryParams.push(action);
    }
    if (startDate) {
      conditions.push('created_at >= ?');
      queryParams.push(new Date(startDate));
    }
    if (endDate) {
      conditions.push('created_at <= ?');
      queryParams.push(new Date(endDate + 'T23:59:59'));
    }
    if (operator) {
      conditions.push('operator = ?');
      queryParams.push(operator);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT id, quote_id, quote_type, action, from_status, to_status, comment, operator, created_at
       FROM quote_audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ) as [any[], any];

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM quote_audit_logs ${whereClause}`,
      queryParams
    ) as [any[], any];

    const total = countResult[0]?.total || 0;

    // 获取关联的报价编号
    const quoteIds = [...new Set(rows.map((r: any) => r.quote_id))];
    const quoteMap: Record<number, string> = {};

    if (quoteIds.length > 0) {
      // 分别查询两种报价类型的编号
      const [maintRows] = await pool.query(
        `SELECT id, quote_number FROM maintenance_quotes WHERE id IN (?)`,
        [quoteIds]
      ) as [any[], any];
      const [engRows] = await pool.query(
        `SELECT id, quote_number FROM engineering_quotes WHERE id IN (?)`,
        [quoteIds]
      ) as [any[], any];

      [...maintRows, ...engRows].forEach((row: any) => {
        quoteMap[row.id] = row.quote_number;
      });
    }

    return NextResponse.json({
      success: true,
      data: rows.map((log: any) => ({
        ...log,
        quoteNumber: quoteMap[log.quote_id] || null
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('获取审核日志列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取审核日志列表失败' },
      { status: 500 }
    );
  }
}
