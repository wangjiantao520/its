import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { validateBody } from '@/lib/api-validate';
import { getDatabase } from '@/lib/database/client';
import { deviceParamsSchema } from './schema';

interface IdRow extends Record<string, unknown> {
  id: string | number | bigint;
}

const tableQueries = {
  device_quotas: 'SELECT * FROM device_quotas ORDER BY category, name',
  self_construction_quotas: 'SELECT * FROM self_construction_quotas ORDER BY category, sort_order',
  intelligent_project_quotas: 'SELECT * FROM intelligent_project_quotas ORDER BY category, sort_order',
  labor_price_config: 'SELECT * FROM labor_price_config ORDER BY sort_order',
  maintenance_device_quotas: 'SELECT * FROM maintenance_device_quotas ORDER BY category, name',
  maintenance_rate_config: 'SELECT * FROM maintenance_rate_config ORDER BY sort_order',
  sla_config: 'SELECT * FROM sla_config ORDER BY sort_order',
} as const;

type DeviceParamType = keyof typeof tableQueries;

function normalizeType(value: string | null): DeviceParamType | null {
  if (value === 'maintenance_rates') return 'maintenance_rate_config';
  if (value === 'sla_configs') return 'sla_config';
  return value && value in tableQueries ? value as DeviceParamType : null;
}

function serializeId(value: unknown): unknown {
  if (typeof value !== 'bigint' && typeof value !== 'number' && typeof value !== 'string') return value;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return value;
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : parsed.toString();
}

const numericIdTypes = new Set<DeviceParamType>([
  'device_quotas',
  'labor_price_config',
  'maintenance_rate_config',
  'sla_config',
]);

function serializeRows(
  rows: Record<string, unknown>[],
  type: DeviceParamType,
): Record<string, unknown>[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (key === 'id' && numericIdTypes.has(type)) return [key, serializeId(value)];
      if (typeof value === 'boolean') return [key, value ? 1 : 0];
      return [key, value];
    }),
  ));
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const rawType = request.nextUrl.searchParams.get('type');
    const database = getDatabase();
    if (!rawType) {
      const entries = await Promise.all(
        Object.entries(tableQueries).map(async ([type, query]) => {
          const result = await database.query<Record<string, unknown>>(query);
          return [type, serializeRows(result.rows, type as DeviceParamType)] as const;
        }),
      );
      return NextResponse.json({ success: true, data: Object.fromEntries(entries) });
    }

    const type = normalizeType(rawType);
    if (!type) {
      return NextResponse.json({ success: false, message: '无效的类型' }, { status: 400 });
    }
    const rows = await database.query<Record<string, unknown>>(tableQueries[type]);
    return NextResponse.json({ success: true, data: serializeRows(rows.rows, type) });
  } catch (error) {
    console.error('获取设备参数失败:', error);
    return NextResponse.json({ success: false, message: `获取失败: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, deviceParamsSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { type, data } = parsed.data;
    let query: string;
    let params: unknown[];
    switch (type) {
      case 'device_quotas':
        query = `INSERT INTO device_quotas
          (category, name, brand, model, specification, maintenance_tier,
           annual_fault_count, a_gear_fault_count, b_gear_fault_count, c_gear_fault_count,
           d_gear_fault_count, e_gear_fault_count, fault_processing_days, inspection_days,
           on_site_count, inspection_labor_fee, visit_service_fee, traffic_fee,
           fault_handling_fee, tool_amortization, consumable_fee, spare_part_reserve, spare_part_fee)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                  $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING id`;
        params = [
          data.category, data.name, data.brand, data.model, data.specification, data.maintenance_tier,
          data.annual_fault_count, data.a_gear_fault_count, data.b_gear_fault_count,
          data.c_gear_fault_count, data.d_gear_fault_count, data.e_gear_fault_count,
          data.fault_processing_days, data.inspection_days, data.on_site_count,
          data.inspection_labor_fee, data.visit_service_fee, data.traffic_fee,
          data.fault_handling_fee, data.tool_amortization, data.consumable_fee,
          data.spare_part_reserve, data.spare_part_fee,
        ];
        break;
      case 'self_construction_quotas':
        query = `INSERT INTO self_construction_quotas
          (id, item_id, category, name, unit, quantity, price, remark, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;
        params = [data.id, data.id, data.category, data.name, data.unit, data.quantity, data.price, data.remark, data.sort_order];
        break;
      case 'intelligent_project_quotas':
        query = `INSERT INTO intelligent_project_quotas
          (id, item_id, serial_number, category, name, brand_model, description,
           deductible_tax_rate, unit, price, remark, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`;
        params = [
          data.id, data.id, data.serial_number, data.category, data.name, data.brand_model,
          data.description, data.deductible_tax_rate, data.unit, data.price, data.remark, data.sort_order,
        ];
        break;
      case 'labor_price_config':
        query = `INSERT INTO labor_price_config
          (level, unit_price, unit, description, sort_order, is_active)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
        params = [data.level, data.unit_price, data.unit || '人天', data.description, data.sort_order, data.is_active];
        break;
      case 'maintenance_device_quotas': {
        const id = data.id || `mdq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        query = `INSERT INTO maintenance_device_quotas
          (id, name, brand, model, specification, category, unit, quantity, original_price,
           maintenance_rate, annual_fee, network_type, remark, sort_order, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id`;
        params = [
          id, data.name, data.brand, data.model, data.specification, data.category, data.unit,
          data.quantity, data.original_price, data.maintenance_rate, data.annual_fee,
          data.network_type, data.remark, data.sort_order, data.is_active,
        ];
        break;
      }
      case 'maintenance_rate_config':
        query = `INSERT INTO maintenance_rate_config
          (device_type, maintenance_rate, description)
          VALUES ($1, $2, $3) RETURNING id`;
        params = [data.device_type, data.maintenance_rate, data.description];
        break;
      case 'sla_config':
        query = `INSERT INTO sla_config
          (sla_level, response_time, resolution_time, penalty_rate, description)
          VALUES ($1, $2, $3, $4, $5) RETURNING id`;
        params = [data.sla_level, data.response_time, data.resolution_time, data.penalty_rate, data.description];
        break;
    }
    await getDatabase().query<IdRow>(query, params);
    return NextResponse.json({ success: true, message: '添加成功' });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ success: false, message: '记录已存在' }, { status: 400 });
    }
    console.error('添加设备参数失败:', error);
    return NextResponse.json({ success: false, message: `添加失败: ${String(error)}` }, { status: 500 });
  }
}
