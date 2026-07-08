import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';
import { SELF_CONSTRUCTION_QUOTA, INTELLIGENT_PROJECT_QUOTA } from '@/lib/self-construction-quota';

// POST /api/quotas-seed - 将前端定额数据初始化到数据库
export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    let selfInserted = 0;
    let intelligentInserted = 0;

    // 同步自施工定额
    for (const item of SELF_CONSTRUCTION_QUOTA) {
      const [existing] = await pool.execute(
        'SELECT id FROM self_construction_quotas WHERE id = ?',
        [item.id]
      );
      if ((existing as any[]).length === 0) {
        await pool.execute(
          `INSERT INTO self_construction_quotas (id, category, name, unit, quantity, price, remark, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.id, item.category, item.name, item.unit, item.quantity, item.price, item.remark || '', 0]
        );
        selfInserted++;
      }
    }

    // 同步智能化项目定额
    for (const item of INTELLIGENT_PROJECT_QUOTA) {
      const [existing] = await pool.execute(
        'SELECT id FROM intelligent_project_quotas WHERE id = ?',
        [item.id]
      );
      if ((existing as any[]).length === 0) {
        await pool.execute(
          `INSERT INTO intelligent_project_quotas (id, serial_number, category, name, brand_model, description, deductible_tax_rate, unit, price, remark, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.id, item.serialNumber, item.category, item.name, item.brandModel || '', item.description || '', item.deductibleTaxRate, item.unit, item.price, item.remark || '', 0]
        );
        intelligentInserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `初始化完成：自施工 ${selfInserted} 条，智能化 ${intelligentInserted} 条`,
      data: { selfInserted, intelligentInserted },
    });
  } catch (error) {
    console.error('初始化定额数据失败:', error);
    return NextResponse.json(
      { success: false, error: '初始化定额数据失败' },
      { status: 500 }
    );
  }
}
