import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * GET /api/device-quotas-db - 从数据库获取设备定额列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let sql = 'SELECT * FROM device_quotas';
    const params: any[] = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY category, name';

    const result = await pool.query(sql, params);
    const devices = (result as any).rows || [];

    // 转换为前端需要的格式
    const formattedDevices = devices.map((d: any) => ({
      id: d.id,
      category: d.category,
      name: d.name,
      brand: d.brand || '',
      model: d.model || '',
      unit: d.unit || '台',
      failureCount: d.failure_count || 1,
      depreciationLevel: d.depreciation_level || '一档',
      serviceTime: d.service_time || '4年',
      warrantyStatus: d.warranty_status || '保内',
      regionType: d.region_type || '一类地区',
      maintenanceLevel: d.maintenance_level || '一级',
      price: d.price || 0,
    }));

    return NextResponse.json({
      success: true,
      data: formattedDevices,
    });
  } catch (error) {
    console.error('获取设备定额失败:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
