import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
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

// POST - 创建分享链接
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const { quoteId, quoteType, expiresInDays } = body;

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: '请提供报价ID (quoteId)' },
        { status: 400 }
      );
    }

    // 验证报价类型
    const validQuoteTypes = ['maintenance', 'engineering'];
    const type = quoteType || 'maintenance';
    if (!validQuoteTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: '无效的报价类型' },
        { status: 400 }
      );
    }

    const tableName = type === 'engineering' ? 'engineering_quotes' : 'maintenance_quotes';

    // 验证报价存在
    const [rows] = await pool.query(
      `SELECT id FROM ${tableName} WHERE id = ?`,
      [quoteId]
    ) as [any[], any];

    const quote = rows[0];
    if (!quote) {
      return NextResponse.json(
        { success: false, error: '报价不存在' },
        { status: 404 }
      );
    }

    // 生成32位十六进制token
    const token = crypto.randomBytes(16).toString('hex');

    // 计算过期时间（默认30天）
    const days = Math.max(1, Math.min(parseInt(String(expiresInDays)) || 30, 365));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

    // 插入分享记录
    const [result] = await pool.query(
      `INSERT INTO quote_shares (token, quote_id, quote_type, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, quoteId, type, expiresAtStr]
    );

    return NextResponse.json({
      success: true,
      data: {
        id: (result as any).insertId,
        token,
        quoteId,
        quoteType: type,
        expiresAt: expiresAt.toISOString(),
        shareUrl: `/share/${token}`
      }
    });
  } catch (error) {
    console.error('创建分享链接失败:', error);
    return NextResponse.json(
      { success: false, error: '创建分享链接失败' },
      { status: 500 }
    );
  }
}

// GET - 获取当前用户的分享链接列表
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = request.nextUrl.searchParams;
    const quoteId = searchParams.get('quoteId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 100);
    const offset = (page - 1) * limit;

    let whereClause = '';
    const queryParams: any[] = [];

    if (quoteId) {
      whereClause = 'WHERE quote_id = ?';
      queryParams.push(parseInt(quoteId));
    }

    const [rows] = await pool.query(
      `SELECT id, token, quote_id, quote_type, expires_at, view_count, created_at
       FROM quote_shares
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ) as [any[], any];

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM quote_shares ${whereClause}`,
      queryParams
    ) as [any[], any];

    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      success: true,
      data: rows.map((row: any) => ({
        ...row,
        shareUrl: `/share/${row.token}`,
        isExpired: row.expires_at && new Date(row.expires_at) < new Date()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('获取分享链接列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取分享链接列表失败' },
      { status: 500 }
    );
  }
}
