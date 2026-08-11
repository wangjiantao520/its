import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { validateBody } from '@/lib/api-validate';
import { getDatabase } from '@/lib/database/client';
import { verifySecondaryPassword } from '@/lib/secondary-password';
import { deviceParamsUpdateSchema } from '../schema';

interface IdRow extends Record<string, unknown> {
  id: string | number | bigint;
}

const deleteTables = {
  device_quotas: 'device_quotas',
  self_construction_quotas: 'self_construction_quotas',
  intelligent_project_quotas: 'intelligent_project_quotas',
  labor_price_config: 'labor_price_config',
  maintenance_device_quotas: 'maintenance_device_quotas',
  maintenance_rate_config: 'maintenance_rate_config',
  sla_config: 'sla_config',
} as const;

const updateColumns: Record<keyof typeof deleteTables, ReadonlySet<string>> = {
  device_quotas: new Set([
    'category', 'name', 'brand', 'model', 'specification', 'maintenance_tier', 'level', 'engineer_level',
    'annual_fault_count', 'a_gear_fault_count', 'b_gear_fault_count',
    'c_gear_fault_count', 'd_gear_fault_count', 'e_gear_fault_count',
    'fault_processing_days', 'inspection_days', 'on_site_count',
    'inspection_labor_fee', 'visit_service_fee', 'traffic_fee',
    'fault_handling_fee', 'tool_amortization', 'consumable_fee',
    'spare_part_reserve', 'spare_part_fee', 'city_price', 'urban_price',
    'town_price', 'rural_price', 'year1_total_price', 'year2_total_price',
    'year3_total_price', 'core_maintenance_content', 'sort_order', 'is_active',
  ]),
  self_construction_quotas: new Set([
    'category', 'name', 'unit', 'quantity', 'price', 'remark', 'sort_order',
  ]),
  intelligent_project_quotas: new Set([
    'serial_number', 'category', 'name', 'brand_model', 'description',
    'deductible_tax_rate', 'unit', 'price', 'remark', 'sort_order',
  ]),
  labor_price_config: new Set([
    'level', 'unit_price', 'unit', 'description', 'sort_order', 'is_active',
  ]),
  maintenance_device_quotas: new Set([
    'name', 'brand', 'model', 'specification', 'category', 'unit', 'quantity',
    'original_price', 'maintenance_rate', 'annual_fee', 'network_type', 'remark',
    'sort_order', 'is_active',
  ]),
  maintenance_rate_config: new Set([
    'device_type', 'rate', 'maintenance_rate', 'description', 'sort_order', 'is_active',
  ]),
  sla_config: new Set([
    'level_name', 'sla_level', 'inspection_frequency', 'response_time',
    'resolution_time', 'fix_time', 'on_site_time', 'penalty_rate', 'description',
    'sort_order', 'is_active',
  ]),
};

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, deviceParamsUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { type, id, data } = parsed.data;
    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [column, value] of Object.entries(data)) {
      if (column !== 'id' && updateColumns[type].has(column) && value !== undefined) {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      }
    }
    if (fields.length === 0) {
      return NextResponse.json({ success: false, message: '没有要更新的字段' }, { status: 400 });
    }
    params.push(id);
    const query = `UPDATE ${deleteTables[type]}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${params.length} RETURNING id`;

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

  const secondaryPassword = request.nextUrl.searchParams.get('secondaryPassword') ?? '';
  const ok = await verifySecondaryPassword(getDatabase(), secondaryPassword);
  if (!ok) {
    return NextResponse.json({ success: false, error: '二级密码错误' }, { status: 403 });
  }

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
