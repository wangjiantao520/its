import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';
import { FULL_DEVICE_QUOTAS } from '@/lib/complete-device-data';
import { SELF_CONSTRUCTION_QUOTA, INTELLIGENT_PROJECT_QUOTA } from '@/lib/self-construction-quota';

// POST /api/seed-all-data - 导入所有设备数据到SQLite数据库
export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    let deviceInserted = 0;
    let selfInserted = 0;
    let intelligentInserted = 0;

    // 1. 导入设备定额数据（使用简化字段映射）
    for (const device of FULL_DEVICE_QUOTAS) {
      // 检查是否已存在（使用name作为唯一标识）
      const [existing] = await pool.execute(
        'SELECT id FROM device_quotas WHERE name = ? AND category = ?',
        [device.name, device.category]
      );
      if ((existing as any[]).length === 0) {
        // 使用数据库中现有的字段
        await pool.execute(
          `INSERT INTO device_quotas (
            category, name, brand, model, specification,
            maintenance_tier, annual_fault_count,
            a_gear_fault_count, b_gear_fault_count, c_gear_fault_count,
            d_gear_fault_count, e_gear_fault_count,
            fault_processing_days, inspection_days, on_site_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            device.category,
            device.name,
            device.model || '', // brand使用model
            device.level || '', // model使用level
            device.levelName || '', // specification使用levelName
            device.level || 'C档', // maintenance_tier
            device.baseFaultCount || 0, // annual_fault_count
            0, // a_gear_fault_count
            0, // b_gear_fault_count
            0, // c_gear_fault_count
            0, // d_gear_fault_count
            0, // e_gear_fault_count
            device.faultHandlingDuration ? device.faultHandlingDuration / 60 / 8 : 0, // fault_processing_days (分钟转天)
            device.inspectionDuration || 0, // inspection_days
            device.inspectionTimesPerYear || 0 // on_site_count
          ]
        );
        deviceInserted++;
      }
    }

    // 2. 导入自施工定额数据
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

    // 3. 导入智能化项目定额数据
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
      message: `数据导入完成！设备定额 ${deviceInserted} 条，自施工定额 ${selfInserted} 条，智能化项目 ${intelligentInserted} 条`,
      data: { deviceInserted, selfInserted, intelligentInserted },
    });
  } catch (error) {
    console.error('导入数据失败:', error);
    return NextResponse.json(
      { success: false, error: '导入数据失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
