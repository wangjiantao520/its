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

// GET - 获取维保报价列表
export async function GET(request: NextRequest) {
  // 认证检查
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10') || 10), 100);
    const offset = (page - 1) * limit;

    // 使用 query 而不是 execute 避免 MySQL prepared statement 参数问题
    const [rows] = await pool.query(
      'SELECT * FROM maintenance_quotes ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM maintenance_quotes'
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
    console.error('获取维保报价列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取维保报价列表失败' },
      { status: 500 }
    );
  }
}

// POST - 创建维保报价
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
      'subtotalBeforeDiscount', 'slaAdjustment', 'regionAdjustment',
      'subtotalAfterCoefficients', 'yearsDiscount', 'bulkDiscount',
      'yearsDiscountAmount', 'bulkDiscountAmount', 'tax', 'total'
    ];

    for (const field of numericFields) {
      if (body[field] !== undefined && (isNaN(Number(body[field])) || Number(body[field]) < 0)) {
        return NextResponse.json(
          { success: false, error: `${field} 必须是有效的非负数字` },
          { status: 400 }
        );
      }
    }

    const [result] = await pool.query(
      `INSERT INTO maintenance_quotes
       (quote_number, project_name, client_name, contact_person, contact_phone,
        region, service_years, engineer_level, sla_config,
        subtotal_before_discount, sla_adjustment, region_adjustment,
        subtotal_after_coefficients, years_discount, bulk_discount,
        years_discount_amount, bulk_discount_amount, tax, total, devices,
        created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.quoteNumber,
        body.projectName,
        body.clientName || null,
        body.contactPerson || null,
        body.contactPhone || null,
        body.region || '城区',
        body.serviceYears || 1,
        body.engineerLevel || '中级',
        JSON.stringify(body.slaConfig || {}),
        body.subtotalBeforeDiscount || 0,
        body.slaAdjustment || 0,
        body.regionAdjustment || 0,
        body.subtotalAfterCoefficients || 0,
        body.yearsDiscount || 1,
        body.bulkDiscount || 1,
        body.yearsDiscountAmount || 0,
        body.bulkDiscountAmount || 0,
        body.tax || 0,
        body.total || 0,
        JSON.stringify(body.devices || []),
        body.createdBy || null,
        body.createdByName || null
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id: (result as any)[0]?.insertId }
    });
  } catch (error) {
    console.error('创建维保报价失败:', error);
    return NextResponse.json(
      { success: false, error: '创建维保报价失败' },
      { status: 500 }
    );
  }
}

// DELETE - 删除维保报价（需要管理员权限）
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
      'DELETE FROM maintenance_quotes WHERE id = ?',
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
    console.error('删除维保报价失败:', error);
    return NextResponse.json(
      { success: false, error: '删除维保报价失败' },
      { status: 500 }
    );
  }
}
