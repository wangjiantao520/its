import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // 从完整设备表读取数据
    const sql = 'SELECT * FROM device_quotas_full WHERE isActive = 1 ORDER BY serialNumber';
    const [result] = await pool.query(sql);
    const devices = result as any[];
    
    return NextResponse.json({
      success: true,
      data: devices
    });
  } catch (error) {
    console.error('获取设备定额列表失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '获取失败: ' + (error as Error).message 
      },
      { status: 500 }
    );
  }
}
