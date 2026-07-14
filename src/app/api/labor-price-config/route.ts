
import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';

// GET /api/labor-price-config - 获取人工单价配置列表
export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active_only') === 'true';

    let query = 'SELECT * FROM labor_price_config';
    const params: any[] = [];

    if (activeOnly) {
      query += ' WHERE is_active = 1';
    }

    query += ' ORDER BY sort_order ASC, id ASC';

    const [rows] = await pool.execute(query, params);

    const parsedRows = (rows as any[]).map(row => ({
      id: row.id,
      level: row.level,
      unitPrice: Number(row.unit_price),
      unit: row.unit || '人天',
      description: row.description || '',
      sortOrder: row.sort_order || 0,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: parsedRows,
    });
  } catch (error) {
    console.error('获取人工单价配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取人工单价配置失败' },
      { status: 500 }
    );
  }
}

// POST /api/labor-price-config - 新增人工单价档位
export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { level, unitPrice, unit, description, sortOrder } = body;

    if (!level || unitPrice === undefined || unitPrice === null) {
      return NextResponse.json(
        { success: false, error: '人员等级和单价为必填项' },
        { status: 400 }
      );
    }

    if (Number(unitPrice) < 0) {
      return NextResponse.json(
        { success: false, error: '单价不能为负数' },
        { status: 400 }
      );
    }

    // 检查等级是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM labor_price_config WHERE level = ?',
      [level]
    );
    if ((existing as any[]).length > 0) {
      return NextResponse.json(
        { success: false, error: `人员等级「${level}」已存在` },
        { status: 400 }
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO labor_price_config (level, unit_price, unit, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [
        level,
        Number(unitPrice),
        unit || '人天',
        description || '',
        sortOrder || 0,
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id: (result as any)[0]?.insertId },
    });
  } catch (error) {
    console.error('新增人工单价档位失败:', error);
    return NextResponse.json(
      { success: false, error: '新增人工单价档位失败' },
      { status: 500 }
    );
  }
}

// PUT /api/labor-price-config - 更新人工单价档位
export async function PUT(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { id, level, unitPrice, unit, description, sortOrder, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少ID' },
        { status: 400 }
      );
    }

    // 检查是否存在
    const [existing] = await pool.execute(
      'SELECT id FROM labor_price_config WHERE id = ?',
      [id]
    );
    if ((existing as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: '记录不存在' },
        { status: 404 }
      );
    }

    const safeValue = (v: any) => v === undefined ? null : v;

    await pool.execute(
      `UPDATE labor_price_config
       SET level = ?, unit_price = ?, unit = ?, description = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [
        safeValue(level),
        unitPrice !== undefined ? Number(unitPrice) : null,
        safeValue(unit) || '人天',
        safeValue(description) || '',
        safeValue(sortOrder) ?? 0,
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('更新人工单价档位失败:', error);
    return NextResponse.json(
      { success: false, error: '更新人工单价档位失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/labor-price-config - 删除人工单价档位
export async function DELETE(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少ID' },
        { status: 400 }
      );
    }

    await pool.execute(
      'DELETE FROM labor_price_config WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除人工单价档位失败:', error);
    return NextResponse.json(
      { success: false, error: '删除人工单价档位失败' },
      { status: 500 }
    );
  }
}
