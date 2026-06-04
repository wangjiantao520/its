import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';
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

// GET - 获取工程报价列表
export async function GET(request: NextRequest) {
  // 认证检查
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    // 初始化数据库表
    await initDatabase();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100); // 限制最大100条
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      'SELECT * FROM engineering_quotes ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM engineering_quotes'
    );
    const total = (countResult as any)[0]?.total || 0;

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
    console.error('获取工程报价列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工程报价列表失败' },
      { status: 500 }
    );
  }
}

// POST - 创建工程报价
export async function POST(request: NextRequest) {
  // 认证检查
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();

    // 输入验证
    if (!body.quoteNumber || !body.projectName) {
      return NextResponse.json(
        { success: false, error: '报价编号和项目名称不能为空' },
        { status: 400 }
      );
    }

    // 验证数字字段
    const numericFields = [
      'constructionArea', 'managementRate', 'profitRate',
      'regulatoryRate', 'taxRate', 'subtotal', 'managementFee',
      'profit', 'regulatoryFee', 'tax', 'total'
    ];

    for (const field of numericFields) {
      if (body[field] !== undefined && (isNaN(Number(body[field])) || Number(body[field]) < 0)) {
        return NextResponse.json(
          { success: false, error: `${field} 必须是有效的非负数字` },
          { status: 400 }
        );
      }
    }

    // 修复: 确保占位符数量与值数量匹配（16个字段）
    const [result] = await pool.query(
      `INSERT INTO engineering_quotes
       (quote_number, project_name, client_name, contact_person, contact_phone,
        construction_area, management_rate, profit_rate, regulatory_rate, tax_rate,
        subtotal, management_fee, profit, regulatory_fee, tax, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.quoteNumber,
        body.projectName,
        body.clientName || null,
        body.contactPerson || null,
        body.contactPhone || null,
        body.constructionArea || 0,
        body.managementRate || 8,
        body.profitRate || 5,
        body.regulatoryRate || 6,
        body.taxRate || 9,
        body.subtotal || 0,
        body.managementFee || 0,
        body.profit || 0,
        body.regulatoryFee || 0,
        body.tax || 0,
        body.total || 0
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id: (result as any).insertId }
    });
  } catch (error) {
    console.error('创建工程报价失败:', error);
    return NextResponse.json(
      { success: false, error: '创建工程报价失败' },
      { status: 500 }
    );
  }
}

// DELETE - 删除工程报价（需要管理员权限）
export async function DELETE(request: NextRequest) {
  // 认证检查
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '请提供要删除的报价ID' },
        { status: 400 }
      );
    }

    // 验证ID是数字
    const quoteId = parseInt(id);
    if (isNaN(quoteId)) {
      return NextResponse.json(
        { success: false, error: '无效的报价ID' },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      'DELETE FROM engineering_quotes WHERE id = ?',
      [quoteId]
    );

    const affectedRows = (result as any).affectedRows;
    if (affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: '报价不存在或已删除' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除工程报价失败:', error);
    return NextResponse.json(
      { success: false, error: '删除工程报价失败' },
      { status: 500 }
    );
  }
}
