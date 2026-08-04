import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { validateBody } from '@/lib/api-validate';
import { getDatabase } from '@/lib/database/client';
import { deviceParamsSchema } from '../schema';

interface IdRow extends Record<string, unknown> {
  id: string | number | bigint;
}

const recordId = z.union([
  z.number().int().positive().safe(),
  z.string().trim().min(1),
]);
const updateSchema = z.intersection(deviceParamsSchema, z.object({ id: recordId }));
const deleteTables = {
  device_quotas: 'device_quotas',
  self_construction_quotas: 'self_construction_quotas',
  intelligent_project_quotas: 'intelligent_project_quotas',
  labor_price_config: 'labor_price_config',
  maintenance_device_quotas: 'maintenance_device_quotas',
  maintenance_rate_config: 'maintenance_rate_config',
  sla_config: 'sla_config',
} as const;

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, updateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { type, id, data } = parsed.data;
    let query: string;
    let params: unknown[];
    switch (type) {
      case 'device_quotas':
        query = `UPDATE device_quotas SET
          category = $1, name = $2, brand = $3, model = $4, specification = $5,
          maintenance_tier = $6, annual_fault_count = $7, a_gear_fault_count = $8,
          b_gear_fault_count = $9, c_gear_fault_count = $10, d_gear_fault_count = $11,
          e_gear_fault_count = $12, fault_processing_days = $13, inspection_days = $14,
          on_site_count = $15, inspection_labor_fee = $16, visit_service_fee = $17,
          traffic_fee = $18, fault_handling_fee = $19, tool_amortization = $20,
          consumable_fee = $21, spare_part_reserve = $22, spare_part_fee = $23,
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $24 RETURNING id`;
        params = [
          data.category, data.name, data.brand, data.model, data.specification, data.maintenance_tier,
          data.annual_fault_count, data.a_gear_fault_count, data.b_gear_fault_count,
          data.c_gear_fault_count, data.d_gear_fault_count, data.e_gear_fault_count,
          data.fault_processing_days, data.inspection_days, data.on_site_count,
          data.inspection_labor_fee, data.visit_service_fee, data.traffic_fee,
          data.fault_handling_fee, data.tool_amortization, data.consumable_fee,
          data.spare_part_reserve, data.spare_part_fee, id,
        ];
        break;
      case 'self_construction_quotas':
        query = `UPDATE self_construction_quotas SET
          category = $1, name = $2, unit = $3, quantity = $4, price = $5,
          remark = $6, sort_order = $7, updated_at = CURRENT_TIMESTAMP
          WHERE id = $8 RETURNING id`;
        params = [data.category, data.name, data.unit, data.quantity, data.price, data.remark, data.sort_order, id];
        break;
      case 'intelligent_project_quotas':
        query = `UPDATE intelligent_project_quotas SET
          serial_number = $1, category = $2, name = $3, brand_model = $4,
          description = $5, deductible_tax_rate = $6, unit = $7, price = $8,
          remark = $9, sort_order = $10, updated_at = CURRENT_TIMESTAMP
          WHERE id = $11 RETURNING id`;
        params = [
          data.serial_number, data.category, data.name, data.brand_model, data.description,
          data.deductible_tax_rate, data.unit, data.price, data.remark, data.sort_order, id,
        ];
        break;
      case 'labor_price_config':
        query = `UPDATE labor_price_config SET
          level = $1, unit_price = $2, unit = $3, description = $4,
          sort_order = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
          WHERE id = $7 RETURNING id`;
        params = [data.level, data.unit_price, data.unit || '人天', data.description, data.sort_order, data.is_active, id];
        break;
      case 'maintenance_device_quotas':
        query = `UPDATE maintenance_device_quotas SET
          name = $1, brand = $2, model = $3, specification = $4, category = $5,
          unit = $6, quantity = $7, original_price = $8, maintenance_rate = $9,
          annual_fee = $10, network_type = $11, remark = $12, sort_order = $13,
          is_active = $14, updated_at = CURRENT_TIMESTAMP
          WHERE id = $15 RETURNING id`;
        params = [
          data.name, data.brand, data.model, data.specification, data.category, data.unit,
          data.quantity, data.original_price, data.maintenance_rate, data.annual_fee,
          data.network_type, data.remark, data.sort_order, data.is_active, id,
        ];
        break;
      case 'maintenance_rate_config':
        query = `UPDATE maintenance_rate_config SET
          device_type = $1, maintenance_rate = $2, description = $3,
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 RETURNING id`;
        params = [data.device_type, data.maintenance_rate, data.description, id];
        break;
      case 'sla_config':
        query = `UPDATE sla_config SET
          sla_level = $1, response_time = $2, resolution_time = $3, penalty_rate = $4,
          description = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6 RETURNING id`;
        params = [data.sla_level, data.response_time, data.resolution_time, data.penalty_rate, data.description, id];
        break;
    }

    const updated = await getDatabase().query<IdRow>(query, params);
    if (!updated.rows[0]) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新设备参数失败:', error);
    return NextResponse.json({ success: false, message: `更新失败: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const type = request.nextUrl.searchParams.get('type');
  const id = request.nextUrl.searchParams.get('id')
    ?? request.nextUrl.pathname.split('/').filter(Boolean).at(-1)
    ?? null;
  if (!type || !id) {
    return NextResponse.json({ success: false, message: '缺少参数' }, { status: 400 });
  }
  if (!(type in deleteTables)) {
    return NextResponse.json({ success: false, message: '无效的类型' }, { status: 400 });
  }

  try {
    const table = deleteTables[type as keyof typeof deleteTables];
    const deleted = await getDatabase().query<IdRow>(
      `DELETE FROM ${table} WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!deleted.rows[0]) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除设备参数失败:', error);
    return NextResponse.json({ success: false, message: `删除失败: ${String(error)}` }, { status: 500 });
  }
}
