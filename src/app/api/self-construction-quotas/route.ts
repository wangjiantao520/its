import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';

// GET /api/self-construction-quotas - 获取自施工定额列表
export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword') || '';
    const category = searchParams.get('category') || '';

    let whereClause = '';
    const params: any[] = [];

    if (keyword) {
      whereClause += ' WHERE (name LIKE ? OR id LIKE ? OR remark LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (category) {
      if (whereClause) {
        whereClause += ' AND category = ?';
      } else {
        whereClause += ' WHERE category = ?';
      }
      params.push(category);
    }

    const [rows] = await pool.execute(
      `SELECT * FROM self_construction_quotas${whereClause} ORDER BY sort_order ASC, id ASC`,
      params
    );

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('获取自施工定额列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取自施工定额列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/self-construction-quotas - 新增自施工定额
export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { id, category, name, unit, quantity, price, remark, sortOrder } = body;

    if (!id || !category || !name || !unit || price === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段（编号、分类、名称、单位、单价）' },
        { status: 400 }
      );
    }

    // 检查ID是否重复
    const [existing] = await pool.execute(
      'SELECT id FROM self_construction_quotas WHERE id = ?',
      [id]
    );
    if ((existing as any[]).length > 0) {
      return NextResponse.json(
        { success: false, error: '定额编号已存在' },
        { status: 400 }
      );
    }

    await pool.execute(
      `INSERT INTO self_construction_quotas (id, category, name, unit, quantity, price, remark, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, category, name, unit, quantity || 1, price, remark || '', sortOrder || 0]
    );

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('新增自施工定额失败:', error);
    return NextResponse.json(
      { success: false, error: '新增自施工定额失败' },
      { status: 500 }
    );
  }
}

// PUT /api/self-construction-quotas - 编辑自施工定额
export async function PUT(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { id, category, name, unit, quantity, price, remark, sortOrder } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少定额编号' },
        { status: 400 }
      );
    }

    // 检查是否存在
    const [existing] = await pool.execute(
      'SELECT id FROM self_construction_quotas WHERE id = ?',
      [id]
    );
    if ((existing as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: '定额项不存在' },
        { status: 404 }
      );
    }

    await pool.execute(
      `UPDATE self_construction_quotas
       SET category = ?, name = ?, unit = ?, quantity = ?, price = ?, remark = ?, sort_order = ?
       WHERE id = ?`,
      [category, name, unit, quantity || 1, price, remark || '', sortOrder || 0, id]
    );

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('编辑自施工定额失败:', error);
    return NextResponse.json(
      { success: false, error: '编辑自施工定额失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/self-construction-quotas - 删除自施工定额
export async function DELETE(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少定额编号' },
        { status: 400 }
      );
    }

    const [result] = await pool.execute(
      'DELETE FROM self_construction_quotas WHERE id = ?',
      [id]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: '定额项不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除自施工定额失败:', error);
    return NextResponse.json(
      { success: false, error: '删除自施工定额失败' },
      { status: 500 }
    );
  }
}
