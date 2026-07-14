import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// 保存用户对AI识别的反馈
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      originalText,
      aiResult,
      correctedResult,
      feedbackType,
      feedbackComment,
      clientName,
      operator,
    } = body;

    if (!originalText || !aiResult || !feedbackType) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const validTypes = ['correct', 'wrong_match', 'missing_info', 'extra_info', 'wrong_quantity', 'other', 'partial'];
    if (!validTypes.includes(feedbackType)) {
      return NextResponse.json(
        { success: false, error: '无效的反馈类型' },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `INSERT INTO ai_feedback
         (original_text, ai_result, corrected_result, feedback_type, feedback_comment, client_name, operator)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          originalText,
          JSON.stringify(aiResult),
          correctedResult ? JSON.stringify(correctedResult) : null,
          feedbackType,
          feedbackComment || null,
          clientName || null,
          operator || null,
        ]
      );

      return NextResponse.json({
        success: true,
        id: (result as any)[0]?.insertId,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('[AI Feedback] 保存失败:', error);
    // 数据库连接失败时，保存到内存作为降级
    return NextResponse.json(
      {
        success: false,
        error: '数据库暂时不可用，反馈已记录待重试',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 503 }
    );
  }
}

// 查询反馈列表（管理员用）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientName = searchParams.get('clientName');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const conn = await pool.getConnection();
    try {
      let query = 'SELECT * FROM ai_feedback WHERE 1=1';
      const params: any[] = [];

      if (clientName) {
        query += ' AND client_name = ?';
        params.push(clientName);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const [rows] = await conn.execute(query, params);
      return NextResponse.json({
        success: true,
        data: rows,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('[AI Feedback] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
