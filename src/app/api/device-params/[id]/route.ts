import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// 更新设备参数
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id, data } = body;

    let query = '';
    let params: unknown[] = [];

    switch (type) {
      case 'device_quotas':
        query = `UPDATE device_quotas SET 
          category=?, name=?, brand=?, model=?, specification=?, 
          maintenance_tier=?, annual_fault_count=?, a_gear_fault_count=?,
          b_gear_fault_count=?, c_gear_fault_count=?, d_gear_fault_count=?,
          e_gear_fault_count=?, fault_processing_days=?, inspection_days=?,
          on_site_count=?, inspection_labor_fee=?, visit_service_fee=?,
          traffic_fee=?, fault_handling_fee=?, tool_amortization=?,
          consumable_fee=?, spare_part_reserve=?, spare_part_fee=? WHERE id=?`;
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
          data.spare_part_reserve || 0, data.spare_part_fee || 0, id
        ];
        break;

      case 'self_construction_quotas':
        query = `UPDATE self_construction_quotas SET 
          category=?, name=?, unit=?, quantity=?, price=?, remark=?, sort_order=? 
          WHERE id=?`;
        params = [
          data.category, data.name, data.unit,
          data.quantity || 1, data.price, data.remark || '', data.sort_order || 0, id
        ];
        break;

      case 'intelligent_project_quotas':
        query = `UPDATE intelligent_project_quotas SET 
          serial_number=?, category=?, name=?, brand_model=?, description=?,
          deductible_tax_rate=?, unit=?, price=?, remark=?, sort_order=? 
          WHERE id=?`;
        params = [
          data.serial_number || 0, data.category, data.name,
          data.brand_model || '', data.description || '',
          data.deductible_tax_rate || 0, data.unit, data.price,
          data.remark || '', data.sort_order || 0, id
        ];
        break;

      case 'labor_price_config':
        query = `UPDATE labor_price_config SET 
          level=?, unit_price=?, unit=?, description=?, sort_order=?, is_active=? 
          WHERE id=?`;
        params = [
          data.level, data.unit_price, data.unit || '人天',
          data.description || '', data.sort_order || 0, 
          data.is_active !== undefined ? data.is_active : 1, id
        ];
        break;

      case 'maintenance_device_quotas':
        query = `UPDATE maintenance_device_quotas SET 
          name=?, brand=?, model=?, specification=?, category=?, unit=?, quantity=?,
          original_price=?, maintenance_rate=?, annual_fee=?, network_type=?, 
          remark=?, sort_order=?, is_active=? 
          WHERE id=?`;
        params = [
          data.name, data.brand || '', data.model || '', data.specification || '',
          data.category || '', data.unit || '台', data.quantity || 1,
          data.original_price || 0, data.maintenance_rate || 0, data.annual_fee || 0,
          data.network_type || '内网', data.remark || '', data.sort_order || 0,
          data.is_active !== undefined ? data.is_active : 1, id
        ];
        break;

      case 'maintenance_rate_config':
        query = `UPDATE maintenance_rate_config SET 
          device_type=?, maintenance_rate=?, description=? 
          WHERE id=?`;
        params = [
          data.device_type, data.maintenance_rate || 0, data.description || '', id
        ];
        break;

      case 'sla_config':
        query = `UPDATE sla_config SET 
          sla_level=?, response_time=?, resolution_time=?, penalty_rate=?, description=? 
          WHERE id=?`;
        params = [
          data.sla_level, data.response_time || 0, data.resolution_time || 0,
          data.penalty_rate || 0, data.description || '', id
        ];
        break;

      default:
        return NextResponse.json({ success: false, message: '无效的类型' }, { status: 400 });
    }

    await pool.execute(query, params);
    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新设备参数失败:', error);
    return NextResponse.json({ success: false, message: '更新失败: ' + String(error) }, { status: 500 });
  }
}

// 删除设备参数
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json({ success: false, message: '缺少参数' }, { status: 400 });
    }

    let query = '';
    switch (type) {
      case 'device_quotas':
        query = 'DELETE FROM device_quotas WHERE id = ?';
        break;
      case 'self_construction_quotas':
        query = 'DELETE FROM self_construction_quotas WHERE id = ?';
        break;
      case 'intelligent_project_quotas':
        query = 'DELETE FROM intelligent_project_quotas WHERE id = ?';
        break;
      case 'labor_price_config':
        query = 'DELETE FROM labor_price_config WHERE id = ?';
        break;
      case 'maintenance_device_quotas':
        query = 'DELETE FROM maintenance_device_quotas WHERE id = ?';
        break;
      case 'maintenance_rate_config':
        query = 'DELETE FROM maintenance_rate_config WHERE id = ?';
        break;
      case 'sla_config':
        query = 'DELETE FROM sla_config WHERE id = ?';
        break;
      default:
        return NextResponse.json({ success: false, message: '无效的类型' }, { status: 400 });
    }

    await pool.execute(query, [id]);
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除设备参数失败:', error);
    return NextResponse.json({ success: false, message: '删除失败: ' + String(error) }, { status: 500 });
  }
}
