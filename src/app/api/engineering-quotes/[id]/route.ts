
import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';

// GET /api/engineering-quotes/[id] - 获取单条工程报价
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    await initDatabase();

    const { id } = await params;

    const [rows] = await pool.execute(
      'SELECT * FROM engineering_quotes WHERE id = ?',
      [id]
    );

    const quoteList = rows as any[];

    if (quoteList.length === 0) {
      return NextResponse.json(
        { success: false, error: '报价单不存在' },
        { status: 404 }
      );
    }
    if (auth.session.role !== 'admin' && quoteList[0].created_by !== String(auth.session.userId ?? -1)) {
      return NextResponse.json({ success: false, error: '报价单不存在或无权访问' }, { status: 404 });
    }

    // 解析 items JSON 字符串
    const quote = {
      ...quoteList[0],
      items: typeof quoteList[0].items === 'string'
        ? JSON.parse(quoteList[0].items)
        : quoteList[0].items,
    };

    return NextResponse.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    console.error('获取工程报价详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工程报价详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/engineering-quotes/[id] - 变更报价单状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    await initDatabase();

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // 校验状态值
    const validStatuses = ['draft', 'submitted', 'approved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: '无效的状态值，可选值：draft, submitted, approved, rejected' },
        { status: 400 }
      );
    }

    // 检查报价单是否存在
    const [existing] = await pool.execute(
      'SELECT id, status, created_by FROM engineering_quotes WHERE id = ?',
      [id]
    );
    if ((existing as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: '报价单不存在' },
        { status: 404 }
      );
    }
    if (auth.session.role !== 'admin' && (existing as any[])[0].created_by !== String(auth.session.userId ?? -1)) {
      return NextResponse.json({ success: false, error: '报价单不存在或无权访问' }, { status: 404 });
    }

    await pool.execute(
      'UPDATE engineering_quotes SET status = ? WHERE id = ?',
      [status, id]
    );

    return NextResponse.json({
      success: true,
      data: { id, status },
    });
  } catch (error) {
    console.error('变更报价状态失败:', error);
    return NextResponse.json(
      { success: false, error: '变更报价状态失败' },
      { status: 500 }
    );
  }
}
