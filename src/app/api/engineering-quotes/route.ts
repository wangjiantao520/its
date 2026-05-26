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

    const [rows] = await pool.execute(
      'SELECT * FROM engineering_quotes ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM engineering_quotes'
    );
    const total = (countResult as any)[0].total;

    return NextResponse.json({
      success: true,
      data: rows,
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
