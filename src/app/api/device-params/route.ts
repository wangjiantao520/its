import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// 获取所有设备参数
export async function GET(request: NextRequest) {
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
      const [maintenanceRates] = await pool.execute('SELECT * FROM maintenance_rates ORDER BY category, name') as [any[], any];
      const [slaConfigs] = await pool.execute('SELECT * FROM sla_configs ORDER BY category, name') as [any[], any];

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
          maintenance_rates: maintenanceRates,
          sla_configs: slaConfigs
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
        query = 'SELECT * FROM maintenance_rates ORDER BY category, name';
        break;
      case 'sla_configs':
        query = 'SELECT * FROM sla_configs ORDER BY category, name';
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

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
          data.category, data.name, data.brand || '', data.model || '',
          data.specification || '', data.maintenance_tier || 'C档',
          data.annual_fault_count || 0, data.a_gear_fault_count || 0,
          data.b_gear_fault_count || 0, data.c_gear_fault_count || 0,
          data.d_gear_fault_count || 0, data.e_gear_fault_count || 0,
          data.fault_processing_days || 0, data.inspection_days || 0,
          data.on_site_count || 0,
          data.inspection_labor_fee || 0, data.visit_service_fee || 0,
          data.traffic_fee || 0, data.fault_handling_fee || 0,
          data.tool_amortization || 0, data.consumable_fee || 0,
          data.spare_part_reserve || 0, data.spare_part_fee || 0
        ];
        break;

      case 'self_construction_quotas':
        query = `INSERT INTO self_construction_quotas 
          (id, category, name, unit, quantity, price, remark, sort_order) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          data.id, data.category, data.name, data.unit,
          data.quantity || 1, data.price, data.remark || '', data.sort_order || 0
        ];
        break;

      case 'intelligent_project_quotas':
        query = `INSERT INTO intelligent_project_quotas 
          (id, serial_number, category, name, brand_model, description, 
           deductible_tax_rate, unit, price, remark, sort_order) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          data.id, data.serial_number || 0, data.category, data.name,
          data.brand_model || '', data.description || '',
          data.deductible_tax_rate || 0, data.unit, data.price,
          data.remark || '', data.sort_order || 0
        ];
        break;

      case 'labor_price_config':
        query = `INSERT INTO labor_price_config 
          (level, unit_price, unit, description, sort_order, is_active) 
          VALUES (?, ?, ?, ?, ?, ?)`;
        params = [
          data.level, data.unit_price, data.unit || '人天',
          data.description || '', data.sort_order || 0, data.is_active !== undefined ? data.is_active : 1
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
