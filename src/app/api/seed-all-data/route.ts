import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { MOCK_DEVICE_QUOTAS } from '@/lib/maintenance-quota';
import { SELF_CONSTRUCTION_QUOTA, type IntelligentItem } from '@/lib/self-construction-quota';

export async function POST(request: NextRequest) {
  try {
    // 导入维保设备定额（完整数据）
    let deviceInserted = 0;
    for (const device of MOCK_DEVICE_QUOTAS) {
      // 检查是否已存在
      const [existingRows] = await pool.query(
        'SELECT id FROM device_quotas WHERE name = ? AND category = ?',
        [device.name, device.category]
      ) as [any[], any];
      
      if (existingRows.length === 0) {
        // 插入完整的维保设备数据
        await pool.execute(
          `INSERT INTO device_quotas (
            name, category, model, level, engineer_level,
            inspection_labor_fee, inspection_person_count, inspection_duration,
            inspection_times_per_year, inspection_content,
            traffic_fee, single_trip_duration, connection_duration,
            on_site_connection_labor_fee, in_warranty_factor,
            base_fault_count, depreciation_factor, fault_service_count,
            fault_handler_count, fault_handling_duration,
            tool_amortization, tool_details, consumable_fee, consumable_details,
            spare_part_reserve, spare_part_basis,
            city_price, fault_handling_fee_total, core_maintenance_content,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            device.name,
            device.category,
            device.model,
            device.level,
            device.engineerLevel,
            device.inspectionLaborFee,
            device.inspectionPersonCount,
            device.inspectionDuration,
            device.inspectionTimesPerYear,
            device.inspectionContent,
            device.trafficFee,
            device.singleTripDuration,
            device.connectionDuration,
            device.onSiteConnectionLaborFee,
            device.inWarrantyFactor,
            device.baseFaultCount,
            device.depreciationFactor,
            device.faultServiceCount,
            device.faultHandlerCount,
            device.faultHandlingDuration,
            device.toolAmortization,
            device.toolDetails,
            device.consumableFee,
            device.consumableDetails,
            device.sparePartReserve,
            device.sparePartBasis,
            device.cityPrice,
            device.faultHandlingFeeTotal,
            device.coreMaintenanceContent,
            deviceInserted,
          ]
        );
        deviceInserted++;
      }
    }

    // 导入自施工定额
    let selfInserted = 0;
    for (const item of SELF_CONSTRUCTION_QUOTA) {
      const [existingRows] = await pool.query(
        'SELECT id FROM self_construction_quotas WHERE id = ?',
        [item.id]
      ) as [any[], any];
      
      if (existingRows.length === 0) {
        await pool.execute(
          `INSERT INTO self_construction_quotas (
            id, category, name, unit, quantity, price, remark, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.category,
            item.name,
            item.unit,
            item.quantity,
            item.price,
            item.remark || '',
            selfInserted,
          ]
        );
        selfInserted++;
      }
    }

    // 导入智能化项目定额
    let intelligentInserted = 0;
    
    // 智能化项目数据（从self-construction-quota.ts导入）
    const intelligentData: IntelligentItem[] = [];
    try {
      // 尝试从文件导入
      const mod = await import('@/lib/self-construction-quota');
      if ('INTELLIGENT_PROJECT_QUOTA' in mod) {
        intelligentData.push(...(mod as any).INTELLIGENT_PROJECT_QUOTA);
      }
    } catch (e) {
      console.log('未找到智能化项目数据');
    }
    
    for (const item of intelligentData) {
      const [existingRows] = await pool.query(
        'SELECT id FROM intelligent_project_quotas WHERE id = ?',
        [item.id]
      ) as [any[], any];
      
      if (existingRows.length === 0) {
        await pool.execute(
          `INSERT INTO intelligent_project_quotas (
            id, serial_number, category, name, brand_model, description,
            deductible_tax_rate, unit, price, remark, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.serialNumber,
            item.category,
            item.name,
            item.brandModel,
            item.description || '',
            item.deductibleTaxRate,
            item.unit,
            item.price,
            item.remark || '',
            intelligentInserted,
          ]
        );
        intelligentInserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `数据导入完成！维保设备 ${deviceInserted} 条，自施工定额 ${selfInserted} 条，智能化项目 ${intelligentInserted} 条`,
      data: {
        deviceInserted,
        selfInserted,
        intelligentInserted,
      },
    });
  } catch (error) {
    console.error('导入数据失败:', error);
    return NextResponse.json(
      { success: false, error: `导入数据失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
