import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { FULL_DEVICE_QUOTAS } from '@/lib/complete-device-data';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';
import {
  INTELLIGENT_PROJECT_QUOTA,
  SELF_CONSTRUCTION_QUOTA,
} from '@/lib/self-construction-quota';

const SEED_BATCH_SIZE = 50;
const deviceColumns = [
  'id', 'category', 'name', 'brand', 'model', 'specification', 'maintenance_tier',
  'level', 'engineer_level', 'annual_fault_count', 'a_gear_fault_count',
  'b_gear_fault_count', 'c_gear_fault_count', 'd_gear_fault_count',
  'e_gear_fault_count', 'fault_processing_days', 'inspection_days', 'on_site_count',
  'inspection_labor_fee', 'inspection_person_count', 'inspection_duration',
  'inspection_times_per_year', 'inspection_content', 'traffic_fee',
  'single_trip_duration', 'connection_duration', 'on_site_connection_labor_fee',
  'in_warranty_factor', 'base_fault_count', 'depreciation_factor',
  'fault_service_count', 'fault_handler_count', 'fault_handling_duration',
  'tool_amortization', 'consumable_fee', 'spare_part_reserve', 'city_price',
  'fault_handling_fee_total', 'year1_total_price', 'year2_total_price',
  'year3_total_price', 'urban_price', 'town_price', 'rural_price',
  'core_maintenance_content', 'sort_order', 'unit', 'is_active',
] as const;

interface ExistingDeviceRow extends Record<string, unknown> {
  category: string;
  name: string;
  model: string | null;
}

function placeholders(rows: number, columns: number): string {
  return Array.from({ length: rows }, (_, row) => `(${
    Array.from({ length: columns }, (__, column) => `$${row * columns + column + 1}`).join(', ')
  })`).join(', ');
}

async function seedAll(database: DatabaseClient) {
  return await database.transaction(async (transaction) => {
    const devices = FULL_DEVICE_QUOTAS.map((device, index) => ({
      device,
      id: -100_001 - index,
      sortOrder: index,
    }));
    let deviceInserted = 0;
    for (let offset = 0; offset < devices.length; offset += SEED_BATCH_SIZE) {
      const batch = devices.slice(offset, offset + SEED_BATCH_SIZE);
      const lookup = await transaction.query<ExistingDeviceRow>(`
        WITH extras(category, name, model) AS (VALUES ${placeholders(batch.length, 3)})
        SELECT existing.category, existing.name, existing.model
        FROM device_quotas AS existing
        INNER JOIN extras
          ON extras.category = existing.category
         AND extras.name = existing.name
         AND extras.model = existing.model
      `, batch.flatMap(({ device }) => [device.category, device.name, device.model]));
      const existingKeys = new Set(
        lookup.rows.map((row) => `${row.category}\0${row.name}\0${row.model ?? ''}`),
      );
      const fresh = batch.filter(({ device }) =>
        !existingKeys.has(`${device.category}\0${device.name}\0${device.model}`)
      );
      if (fresh.length === 0) continue;
      const inserted = await transaction.query(`
        INSERT INTO device_quotas (
          id, category, name, brand, model, specification, maintenance_tier,
          level, engineer_level, annual_fault_count, a_gear_fault_count,
          b_gear_fault_count, c_gear_fault_count, d_gear_fault_count,
          e_gear_fault_count, fault_processing_days, inspection_days, on_site_count,
          inspection_labor_fee, inspection_person_count, inspection_duration,
          inspection_times_per_year, inspection_content, traffic_fee,
          single_trip_duration, connection_duration, on_site_connection_labor_fee,
          in_warranty_factor, base_fault_count, depreciation_factor,
          fault_service_count, fault_handler_count, fault_handling_duration,
          tool_amortization, consumable_fee, spare_part_reserve, city_price,
          fault_handling_fee_total, year1_total_price, year2_total_price,
          year3_total_price, urban_price, town_price, rural_price,
          core_maintenance_content, sort_order, unit, is_active
        )
        VALUES ${placeholders(fresh.length, deviceColumns.length)}
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, fresh.flatMap(({ device, id, sortOrder }) => [
        id,
        device.category,
        device.name,
        null,
        device.model,
        null,
        device.level || null,
        device.level || 'A',
        device.engineerLevel || '初级',
        device.baseFaultCount || 0,
        0, 0, 0, 0, 0,
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
        device.faultHandlerCount || 1,
        device.faultHandlingDuration || 0,
        device.toolAmortization || 0,
        device.consumableFee || 0,
        device.sparePartReserve || 0,
        device.cityPrice || 0,
        device.faultHandlingFeeTotal || 0,
        device.year1TotalPrice || 0,
        device.year2TotalPrice || 0,
        device.year3TotalPrice || 0,
        device.urbanPrice || 0,
        device.townPrice || 0,
        device.ruralPrice || 0,
        device.coreMaintenanceContent || '',
        sortOrder,
        device.unit || '台',
        device.isActive ?? true,
      ]));
      deviceInserted += inserted.rowCount;
    }

    let selfInserted = 0;
    for (let offset = 0; offset < SELF_CONSTRUCTION_QUOTA.length; offset += SEED_BATCH_SIZE) {
      const batch = SELF_CONSTRUCTION_QUOTA.slice(offset, offset + SEED_BATCH_SIZE);
      const inserted = await transaction.query(`
        INSERT INTO self_construction_quotas
          (id, item_id, category, name, unit, quantity, price, remark, sort_order)
        VALUES ${placeholders(batch.length, 9)}
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, batch.flatMap((item, index) => [
        item.id, item.id, item.category, item.name, item.unit, item.quantity,
        item.price, item.remark || '', offset + index,
      ]));
      selfInserted += inserted.rowCount;
    }

    let intelligentInserted = 0;
    for (let offset = 0; offset < INTELLIGENT_PROJECT_QUOTA.length; offset += SEED_BATCH_SIZE) {
      const batch = INTELLIGENT_PROJECT_QUOTA.slice(offset, offset + SEED_BATCH_SIZE);
      const inserted = await transaction.query(`
        INSERT INTO intelligent_project_quotas
          (id, item_id, serial_number, category, name, brand_model, description,
           deductible_tax_rate, unit, price, remark, sort_order)
        VALUES ${placeholders(batch.length, 12)}
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, batch.flatMap((item, index) => [
        item.id, item.id, item.serialNumber, item.category, item.name,
        item.brandModel || '', item.description || '', item.deductibleTaxRate,
        item.unit, item.price, item.remark || '', offset + index,
      ]));
      intelligentInserted += inserted.rowCount;
    }
    return { deviceInserted, selfInserted, intelligentInserted };
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const data = await seedAll(getDatabase());
    return NextResponse.json({
      success: true,
      message: `定额库导入完成！维保设备 ${data.deviceInserted} 条，自施工定额 ${data.selfInserted} 条，智能化项目 ${data.intelligentInserted} 条`,
      data,
    });
  } catch (error) {
    console.error('导入定额库失败:', error);
    return NextResponse.json({ success: false, error: '导入定额库失败' }, { status: 500 });
  }
}
