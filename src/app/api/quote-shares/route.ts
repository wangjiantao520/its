
import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';
import crypto from 'crypto';

// POST /api/quote-shares - 创建分享链接
export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { quoteId, password, expiresInDays, maxViews, remark } = body;

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: '缺少报价单ID' },
        { status: 400 }
      );
    }

    // 检查报价单是否存在
    const [quotes] = await pool.execute(
      'SELECT id, quote_number, project_name FROM engineering_quotes WHERE id = ?',
      [quoteId]
    );
    if ((quotes as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: '报价单不存在' },
        { status: 404 }
      );
    }

    // 生成唯一分享token
    const shareToken = crypto.randomBytes(24).toString('hex');

    // 计算过期时间
    let expiresAt: string | null = null;
    if (expiresInDays && expiresInDays > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expiresInDays);
      expiresAt = expDate.toISOString().slice(0, 19).replace('T', ' ');
    }

    const [result] = await pool.execute(
      `INSERT INTO quote_shares (quote_id, share_token, password, expires_at, max_views, view_count, is_active, remark)
       VALUES (?, ?, ?, ?, ?, 0, 1, ?)`,
      [quoteId, shareToken, password || null, expiresAt, maxViews || 0, remark || null]
    );

    return NextResponse.json({
      success: true,
      data: {
        id: (result as any).insertId,
        shareToken,
        expiresAt,
        shareUrl: `/share/${shareToken}`,
      },
    });
  } catch (error) {
    console.error('创建分享链接失败:', error);
    return NextResponse.json(
      { success: false, error: '创建分享链接失败' },
      { status: 500 }
    );
  }
}

// GET /api/quote-shares?quoteId=xxx - 获取某个报价单的分享记录列表
export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    const searchParams = request.nextUrl.searchParams;
    const quoteId = searchParams.get('quoteId');

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: '缺少报价单ID' },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute(
      `SELECT id, quote_id, share_token, password, expires_at, max_views, view_count, is_active, remark, created_at
       FROM quote_shares WHERE quote_id = ? ORDER BY created_at DESC`,
      [quoteId]
    );

    const shares = (rows as any[]).map(row => ({
      id: row.id,
      quoteId: row.quote_id,
      shareToken: row.share_token,
      hasPassword: !!row.password,
      password: row.password,
      expiresAt: row.expires_at,
      maxViews: row.max_views,
      viewCount: row.view_count,
      isActive: row.is_active === 1,
      remark: row.remark || '',
      createdAt: row.created_at,
      shareUrl: `/share/${row.share_token}`,
      isExpired: row.expires_at ? new Date(row.expires_at) < new Date() : false,
    }));

    return NextResponse.json({
      success: true,
      data: shares,
    });
  } catch (error) {
    console.error('获取分享记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取分享记录失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/quote-shares - 停用/删除分享链接
export async function DELETE(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少分享记录ID' },
        { status: 400 }
      );
    }

    await pool.execute(
      'UPDATE quote_shares SET is_active = 0 WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      message: '分享链接已停用',
    });
  } catch (error) {
    console.error('停用分享链接失败:', error);
    return NextResponse.json(
      { success: false, error: '停用分享链接失败' },
      { status: 500 }
    );
  }
}
