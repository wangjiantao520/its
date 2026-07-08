import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';

// POST /api/engineering-quotes/batch-export - 批量获取报价单详情
export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '请选择至少一条报价单' },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { success: false, error: '单次批量导出不能超过100条' },
        { status: 400 }
      );
    }

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT * FROM engineering_quotes WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
      ids
    );

    // 解析 items JSON 字符串
    const parsedRows = (rows as any[]).map(row => ({
      ...row,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    }));

    return NextResponse.json({
      success: true,
      data: parsedRows,
    });
  } catch (error) {
    console.error('批量获取报价单失败:', error);
    return NextResponse.json(
      { success: false, error: '批量获取报价单失败' },
      { status: 500 }
    );
  }
}
