import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { FULL_DEVICE_QUOTAS } from '@/lib/complete-device-data';
import { SELF_CONSTRUCTION_QUOTA, INTELLIGENT_PROJECT_QUOTA } from '@/lib/self-construction-quota';

export async function POST() {
  try {
    // 1. 导入维保设备定额（完整版123条）
    let deviceInserted = 0;
    for (const device of FULL_DEVICE_QUOTAS) {
      const [existing] = await pool.execute(
        'SELECT id FROM device_quotas WHERE name = ? AND category = ?',
        [device.name, device.category]
      ) as any[][];
      
      if (existing.length === 0) {
        await pool.execute(
          `INSERT INTO device_quotas (
            category, name, brand, model, specification, maintenance_tier,
            level, engineer_level, annual_fault_count,
            a_gear_fault_count, b_gear_fault_count, c_gear_fault_count,
            d_gear_fault_count, e_gear_fault_count,
            fault_processing_days, inspection_days, on_site_count,
            inspection_labor_fee, inspection_person_count, inspection_duration,
            inspection_times_per_year, inspection_content,
            traffic_fee, single_trip_duration, connection_duration,
            on_site_connection_labor_fee,
            in_warranty_factor, base_fault_count, depreciation_factor,
            fault_service_count, fault_handler_count, fault_handling_duration,
            tool_amortization, consumable_fee, spare_part_reserve,
            city_price, fault_handling_fee_total,
            year1_total_price, year2_total_price, year3_total_price,
            urban_price, town_price, rural_price,
            core_maintenance_content, sort_order, unit, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            device.category,
            device.name,
            null, // brand
            device.model,
            null, // specification
            device.level || null,
            device.level || 'A',
            device.engineerLevel || '初级',
            device.baseFaultCount || 0,
            0, 0, 0, 0, 0, // gear fault counts
            0, 0, 0,
            device.inspectionLaborFee || 0,
            device.inspectionPersonCount || 1,
            device.inspectionDuration || 0,
            device.inspectionTimesPerYear || 4,
            device.inspectionContent || '',
            device.trafficFee || 0,
            device.singleTripDuration || 0,
            device.connectionDuration || 0,
            device.onSiteConnectionLaborFee || 0,
            device.inWarrantyFactor || 1,
            device.baseFaultCount || 1,
            device.depreciationFactor || 0.6,
            device.faultServiceCount || 1,
            1,
            device.faultHandlingDuration || 0,
            device.toolAmortization || 0,
            device.consumableFee || 0,
            device.sparePartReserve || 0,
            device.cityPrice || 0,
            device.faultHandlingFeeDetail || 0,
            device.year1TotalPrice || 0,
            device.year2TotalPrice || 0,
            device.year3TotalPrice || 0,
            device.urbanPrice || 0,
            device.townPrice || 0,
            device.ruralPrice || 0,
            device.coreMaintenanceContent || '',
            0, // sort_order
            device.unit || '台',
            1
          ]
        );
        deviceInserted++;
      }
    }

    // 2. 导入自施工定额
    let selfInserted = 0;
    for (const item of SELF_CONSTRUCTION_QUOTA) {
      const [existing] = await pool.execute(
        'SELECT id FROM self_construction_quotas WHERE name = ? AND category = ?',
        [item.name, item.category]
      ) as any[][];
      
      if (existing.length === 0) {
        await pool.execute(
          `INSERT INTO self_construction_quotas (
            item_id, category, name, unit, quantity, price, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.category,
            item.name,
            item.unit,
            item.quantity,
            item.price,
            item.remark || ''
          ]
        );
        selfInserted++;
      }
    }

    // 3. 导入智能化项目定额
    let intelligentInserted = 0;
    for (const item of INTELLIGENT_PROJECT_QUOTA) {
      const [existing] = await pool.execute(
        'SELECT id FROM intelligent_project_quotas WHERE name = ? AND category = ?',
        [item.name, item.category]
      ) as any[][];
      
      if (existing.length === 0) {
        await pool.execute(
          `INSERT INTO intelligent_project_quotas (
            item_id, category, name, brand_model, unit,
            price, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.category,
            item.name,
            item.brandModel,
            item.unit,
            item.price,
            item.remark || ''
          ]
        );
        intelligentInserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `定额库导入完成！维保设备 ${deviceInserted} 条，自施工定额 ${selfInserted} 条，智能化项目 ${intelligentInserted} 条`,
      data: {
        deviceInserted,
        selfInserted,
        intelligentInserted
      }
    });
  } catch (error) {
    console.error('导入定额库失败:', error);
    return NextResponse.json(
      { success: false, error: `导入定额库失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
