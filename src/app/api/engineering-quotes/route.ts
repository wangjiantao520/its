import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';

// 初始化数据库
export async function GET(request: NextRequest) {
  try {
    // 初始化数据库表
    await initDatabase();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const keyword = searchParams.get('keyword') || '';
    const status = searchParams.get('status') || '';

    // 构建查询条件
    let whereClause = '';
    const params: any[] = [];

    if (keyword) {
      whereClause += ' WHERE (project_name LIKE ? OR client_name LIKE ? OR quote_number LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (status) {
      if (whereClause) {
        whereClause += ' AND status = ?';
      } else {
        whereClause += ' WHERE status = ?';
      }
      params.push(status);
    }

    const [rows] = await pool.execute(
      `SELECT * FROM engineering_quotes${whereClause} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM engineering_quotes${whereClause}`,
      params
    );
    const total = (countResult as any)[0].total;

    // 解析 items JSON 字符串
    const parsedRows = (rows as any[]).map(row => ({
      ...row,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    }));

    return NextResponse.json({
      success: true,
      data: parsedRows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      quoteNumber,
      projectName,
      clientName,
      contactPerson,
      contactPhone,
      constructionArea,
      managementRate,
      profitRate,
      regulatoryRate,
      taxRate,
      subtotal,
      managementFee,
      profit,
      regulatoryFee,
      tax,
      total,
      items
    } = body;

    const [result] = await pool.execute(
      `INSERT INTO engineering_quotes 
       (quote_number, project_name, client_name, contact_person, contact_phone, 
        construction_area, management_rate, profit_rate, regulatory_rate, tax_rate,
        subtotal, management_fee, profit, regulatory_fee, tax, total, items)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quoteNumber,
        projectName,
        clientName,
        contactPerson,
        contactPhone,
        constructionArea,
        managementRate,
        profitRate,
        regulatoryRate,
        taxRate,
        subtotal,
        managementFee,
        profit,
        regulatoryFee,
        tax,
        total,
        JSON.stringify(items)
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      quoteNumber,
      projectName,
      clientName,
      contactPerson,
      contactPhone,
      constructionArea,
      managementRate,
      profitRate,
      regulatoryRate,
      taxRate,
      subtotal,
      managementFee,
      profit,
      regulatoryFee,
      tax,
      total,
      items,
      status
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少报价ID' },
        { status: 400 }
      );
    }

    // 将 undefined 转为 null，避免 MySQL2 报错
    const safeValue = (v: any) => v === undefined ? null : v;

    const [result] = await pool.execute(
      `UPDATE engineering_quotes
       SET quote_number = ?, project_name = ?, client_name = ?, contact_person = ?, contact_phone = ?,
           construction_area = ?, management_rate = ?, profit_rate = ?, regulatory_rate = ?, tax_rate = ?,
           subtotal = ?, management_fee = ?, profit = ?, regulatory_fee = ?, tax = ?, total = ?,
           items = ?, status = ?
       WHERE id = ?`,
      [
        safeValue(quoteNumber),
        safeValue(projectName),
        safeValue(clientName),
        safeValue(contactPerson),
        safeValue(contactPhone),
        safeValue(constructionArea),
        safeValue(managementRate),
        safeValue(profitRate),
        safeValue(regulatoryRate),
        safeValue(taxRate),
        safeValue(subtotal),
        safeValue(managementFee),
        safeValue(profit),
        safeValue(regulatoryFee),
        safeValue(tax),
        safeValue(total),
        JSON.stringify(items),
        status || 'draft',
        id
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id }
    });
  } catch (error) {
    console.error('更新工程报价失败:', error);
    return NextResponse.json(
      { success: false, error: '更新工程报价失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password } = body;

    // 二级密码验证
    const ADMIN_PASSWORD = 'ecloud10086';
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: '密码错误' },
        { status: 401 }
      );
    }

    const [result] = await pool.execute(
      'DELETE FROM engineering_quotes WHERE id = ?',
      [id]
    );

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
