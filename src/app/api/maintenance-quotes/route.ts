import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      'SELECT * FROM maintenance_quotes ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM maintenance_quotes'
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
    console.error('获取维保报价列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取维保报价列表失败' },
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
      region,
      serviceYears,
      engineerLevel,
      slaConfig,
      subtotalBeforeDiscount,
      slaAdjustment,
      regionAdjustment,
      subtotalAfterCoefficients,
      yearsDiscount,
      bulkDiscount,
      yearsDiscountAmount,
      bulkDiscountAmount,
      tax,
      total,
      devices
    } = body;

    const [result] = await pool.execute(
      `INSERT INTO maintenance_quotes 
       (quote_number, project_name, client_name, contact_person, contact_phone,
        region, service_years, engineer_level, sla_config,
        subtotal_before_discount, sla_adjustment, region_adjustment,
        subtotal_after_coefficients, years_discount, bulk_discount,
        years_discount_amount, bulk_discount_amount, tax, total, devices)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quoteNumber,
        projectName,
        clientName,
        contactPerson,
        contactPhone,
        region,
        serviceYears,
        engineerLevel,
        JSON.stringify(slaConfig),
        subtotalBeforeDiscount,
        slaAdjustment,
        regionAdjustment,
        subtotalAfterCoefficients,
        yearsDiscount,
        bulkDiscount,
        yearsDiscountAmount,
        bulkDiscountAmount,
        tax,
        total,
        JSON.stringify(devices)
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id: (result as any).insertId }
    });
  } catch (error) {
    console.error('创建维保报价失败:', error);
    return NextResponse.json(
      { success: false, error: '创建维保报价失败' },
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
      'DELETE FROM maintenance_quotes WHERE id = ?',
      [id]
    );

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
