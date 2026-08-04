import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { pool } from '@/lib/db';
import { validateBody } from '@/lib/api-validate';
import { z } from 'zod';

// 获取所有设备参数
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // device_quotas, self_construction, intelligent_project, labor_price

    if (!type) {
      // 返回所有类型的汇总
      const [deviceQuotas] = await pool.execute('SELECT * FROM device_quotas ORDER BY category, name') as [any[], any];
      const [selfConstruction] = await pool.execute('SELECT * FROM self_construction_quotas ORDER BY category, sort_order') as [any[], any];
      const [intelligentProject] = await pool.execute('SELECT * FROM intelligent_project_quotas ORDER BY category, sort_order') as [any[], any];
      const [laborPrice] = await pool.execute('SELECT * FROM labor_price_config ORDER BY sort_order') as [any[], any];
      const [maintenanceDeviceQuotas] = await pool.execute('SELECT * FROM maintenance_device_quotas ORDER BY category, name') as [any[], any];
      const [maintenanceRates] = await pool.execute('SELECT * FROM maintenance_rate_config ORDER BY sort_order') as [any[], any];
      const [slaConfigs] = await pool.execute('SELECT * FROM sla_config ORDER BY sort_order') as [any[], any];

      console.log('查询结果:', {
        deviceQuotas: deviceQuotas.length,
        selfConstruction: selfConstruction.length,
        intelligentProject: intelligentProject.length,
        laborPrice: laborPrice.length,
        maintenanceDeviceQuotas: maintenanceDeviceQuotas.length,
        maintenanceRates: maintenanceRates.length,
        slaConfigs: slaConfigs.length
      });

      return NextResponse.json({
        success: true,
        data: {
          device_quotas: deviceQuotas,
          self_construction_quotas: selfConstruction,
          intelligent_project_quotas: intelligentProject,
          labor_price_config: laborPrice,
          maintenance_device_quotas: maintenanceDeviceQuotas,
          maintenance_rate_config: maintenanceRates,
          sla_config: slaConfigs
        }
      });
    }

    let query = '';
    switch (type) {
      case 'device_quotas':
        query = 'SELECT * FROM device_quotas ORDER BY category, name';
        break;
      case 'self_construction_quotas':
        query = 'SELECT * FROM self_construction_quotas ORDER BY category, sort_order';
        break;
      case 'intelligent_project_quotas':
        query = 'SELECT * FROM intelligent_project_quotas ORDER BY category, sort_order';
        break;
      case 'labor_price_config':
        query = 'SELECT * FROM labor_price_config ORDER BY sort_order';
        break;
      case 'maintenance_device_quotas':
        query = 'SELECT * FROM maintenance_device_quotas ORDER BY category, name';
        break;
      case 'maintenance_rates':
        query = 'SELECT * FROM maintenance_rate_config ORDER BY sort_order';
        break;
      case 'sla_configs':
        query = 'SELECT * FROM sla_config ORDER BY sort_order';
        break;
      default:
        return NextResponse.json({ success: false, message: '无效的类型' }, { status: 400 });
    }

    const [rows] = await pool.execute(query);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取设备参数失败:', error);
    return NextResponse.json({ success: false, message: '获取失败: ' + String(error) }, { status: 500 });
  }
}

// 新增设备参数
// 校验 schema：按 type 区分的联合类型，每种 type 对应不同字段
const nonNeg = z.coerce.number().nonnegative();
const optNonNeg = z.coerce.number().nonnegative().optional().default(0);
const optStr = z.string().optional().default('');

const deviceParamsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('device_quotas'),
    data: z.object({
      category: z.string().min(1, 'category 不能为空'),
      name: z.string().min(1, 'name 不能为空'),
      brand: optStr,
      model: optStr,
      specification: optStr,
      maintenance_tier: optStr.default('C档'),
      annual_fault_count: optNonNeg,
      a_gear_fault_count: optNonNeg,
      b_gear_fault_count: optNonNeg,
      c_gear_fault_count: optNonNeg,
      d_gear_fault_count: optNonNeg,
      e_gear_fault_count: optNonNeg,
      fault_processing_days: optNonNeg,
      inspection_days: optNonNeg,
      on_site_count: optNonNeg,
      inspection_labor_fee: optNonNeg,
      visit_service_fee: optNonNeg,
      traffic_fee: optNonNeg,
      fault_handling_fee: optNonNeg,
      tool_amortization: optNonNeg,
      consumable_fee: optNonNeg,
      spare_part_reserve: optNonNeg,
      spare_part_fee: optNonNeg,
    }),
  }),
  z.object({
    type: z.literal('self_construction_quotas'),
    data: z.object({
      id: z.string().min(1, 'id 不能为空'),
      category: z.string().min(1, 'category 不能为空'),
      name: z.string().min(1, 'name 不能为空'),
      unit: z.string().min(1, 'unit 不能为空'),
      quantity: optNonNeg.default(1),
      price: nonNeg,
      remark: optStr,
      sort_order: optNonNeg,
    }),
  }),
  z.object({
    type: z.literal('intelligent_project_quotas'),
    data: z.object({
      id: z.string().min(1, 'id 不能为空'),
      category: z.string().min(1, 'category 不能为空'),
      name: z.string().min(1, 'name 不能为空'),
      unit: z.string().min(1, 'unit 不能为空'),
      price: nonNeg,
      serial_number: optNonNeg,
      brand_model: optStr,
      description: optStr,
      deductible_tax_rate: optNonNeg,
      remark: optStr,
      sort_order: optNonNeg,
    }),
  }),
  z.object({
    type: z.literal('labor_price_config'),
    data: z.object({
      level: z.string().min(1, 'level 不能为空'),
      unit_price: nonNeg,
      unit: optStr.default('人天'),
      description: optStr,
      sort_order: optNonNeg,
      is_active: z.coerce.number().int().min(0).max(1).optional().default(1),
    }),
  }),
  z.object({
    type: z.literal('maintenance_device_quotas'),
    data: z.object({
      name: z.string().min(1, 'name 不能为空'),
      brand: optStr,
      model: optStr,
      specification: optStr,
      category: optStr,
      unit: optStr.default('台'),
      quantity: optNonNeg.default(1),
      original_price: optNonNeg,
      maintenance_rate: optNonNeg,
      annual_fee: optNonNeg,
      network_type: optStr.default('内网'),
      remark: optStr,
      sort_order: optNonNeg,
      is_active: z.coerce.number().int().min(0).max(1).optional().default(1),
      id: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('maintenance_rate_config'),
    data: z.object({
      device_type: z.string().min(1, 'device_type 不能为空'),
      maintenance_rate: optNonNeg,
      description: optStr,
    }),
  }),
  z.object({
    type: z.literal('sla_config'),
    data: z.object({
      sla_level: z.string().min(1, 'sla_level 不能为空'),
      response_time: optNonNeg,
      resolution_time: optNonNeg,
      penalty_rate: optNonNeg,
      description: optStr,
    }),
  }),
]);

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const parsed = await validateBody(request, deviceParamsSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { type, data } = parsed.data;

    let query = '';
    let params: unknown[] = [];

    switch (type) {
      case 'device_quotas':
        query = `INSERT INTO device_quotas
          (category, name, brand, model, specification, maintenance_tier,
           annual_fault_count, a_gear_fault_count, b_gear_fault_count,
           c_gear_fault_count, d_gear_fault_count, e_gear_fault_count,
           fault_processing_days, inspection_days, on_site_count,
           inspection_labor_fee, visit_service_fee, traffic_fee,
           fault_handling_fee, tool_amortization, consumable_fee,
           spare_part_reserve, spare_part_fee)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          data.category, data.name, data.brand, data.model,
          data.specification, data.maintenance_tier,
          data.annual_fault_count, data.a_gear_fault_count,
          data.b_gear_fault_count, data.c_gear_fault_count,
          data.d_gear_fault_count, data.e_gear_fault_count,
          data.fault_processing_days, data.inspection_days,
          data.on_site_count,
          data.inspection_labor_fee, data.visit_service_fee,
          data.traffic_fee, data.fault_handling_fee,
          data.tool_amortization, data.consumable_fee,
          data.spare_part_reserve, data.spare_part_fee
        ];
        break;

      case 'self_construction_quotas':
        query = `INSERT INTO self_construction_quotas
          (id, category, name, unit, quantity, price, remark, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          data.id, data.category, data.name, data.unit,
          data.quantity, data.price, data.remark, data.sort_order
        ];
        break;

      case 'intelligent_project_quotas':
        query = `INSERT INTO intelligent_project_quotas
          (id, serial_number, category, name, brand_model, description,
           deductible_tax_rate, unit, price, remark, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          data.id, data.serial_number, data.category, data.name,
          data.brand_model, data.description,
          data.deductible_tax_rate, data.unit, data.price,
          data.remark, data.sort_order
        ];
        break;

      case 'labor_price_config':
        query = `INSERT INTO labor_price_config
          (level, unit_price, unit, description, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?)`;
        params = [
          data.level, data.unit_price, data.unit,
          data.description, data.sort_order, data.is_active
        ];
        break;

      case 'maintenance_device_quotas':
        const mdqId = data.id || `mdq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        query = `INSERT INTO maintenance_device_quotas
          (id, name, brand, model, specification, category, unit, quantity,
           original_price, maintenance_rate, annual_fee, network_type, remark, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          mdqId,
          data.name, data.brand, data.model, data.specification,
          data.category, data.unit, data.quantity,
          data.original_price, data.maintenance_rate, data.annual_fee,
          data.network_type, data.remark, data.sort_order, data.is_active
        ];
        break;

      case 'maintenance_rate_config':
        query = `INSERT INTO maintenance_rate_config
          (device_type, maintenance_rate, description)
          VALUES (?, ?, ?)`;
        params = [
          data.device_type, data.maintenance_rate, data.description
        ];
        break;

      case 'sla_config':
        query = `INSERT INTO sla_config
          (sla_level, response_time, resolution_time, penalty_rate, description)
          VALUES (?, ?, ?, ?, ?)`;
        params = [
          data.sla_level, data.response_time, data.resolution_time,
          data.penalty_rate, data.description
        ];
        break;

      default:
        return NextResponse.json({ success: false, message: '无效的类型' }, { status: 400 });
    }

    await pool.execute(query, params);
    return NextResponse.json({ success: true, message: '添加成功' });
  } catch (error) {
    console.error('添加设备参数失败:', error);
    return NextResponse.json({ success: false, message: '添加失败: ' + String(error) }, { status: 500 });
  }
}
