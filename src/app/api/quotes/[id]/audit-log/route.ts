import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySession } from '@/lib/auth';

// 认证中间件
function requireAuth(request: NextRequest): { authorized: boolean; response?: NextResponse } {
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
  return { authorized: true };
}

// GET - 获取报价审核日志
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT id, quote_id, quote_type, action, from_status, to_status, comment, operator, created_at
       FROM quote_audit_logs
       WHERE quote_id = ? AND quote_type = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [quoteId, quoteType, limit, offset]
    ) as [any[], any];

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM quote_audit_logs WHERE quote_id = ? AND quote_type = ?`,
      [quoteId, quoteType]
    ) as [any[], any];

    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('获取审核日志失败:', error);
    return NextResponse.json(
      { success: false, error: '获取审核日志失败' },
      { status: 500 }
    );
  }
}
