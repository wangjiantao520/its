import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { FULL_DEVICE_QUOTAS } from '@/lib/complete-device-data';

export async function POST() {
  try {
    // 删除旧表并重建（简化版，只保留核心字段）
    await pool.execute('DROP TABLE IF EXISTS device_quotas_full');
    
    await pool.execute(`
      CREATE TABLE device_quotas_full (
        id TEXT PRIMARY KEY,
        serialNumber INTEGER,
        category TEXT,
        name TEXT,
        model TEXT,
        level TEXT,
        levelName TEXT,
        engineerLevel TEXT,
        deviceCount INTEGER,
        unit TEXT,
        inspectionLaborFee REAL,
        onSiteFeeAnnual REAL,
        trafficFee REAL,
        faultHandlingFeeTotal REAL,
        cityPrice REAL,
        year1TotalPrice REAL,
        year2TotalPrice REAL,
        year3TotalPrice REAL,
        urbanPrice REAL,
        townPrice REAL,
        ruralPrice REAL,
        inspectionContent TEXT,
        coreMaintenanceContent TEXT,
        isActive INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 导入核心数据
    let inserted = 0;
    for (const device of FULL_DEVICE_QUOTAS) {
      await pool.execute(
        `INSERT INTO device_quotas_full (
          id, serialNumber, category, name, model, level, levelName,
          engineerLevel, deviceCount, unit, inspectionLaborFee,
          onSiteFeeAnnual, trafficFee, faultHandlingFeeTotal, cityPrice,
          year1TotalPrice, year2TotalPrice, year3TotalPrice,
          urbanPrice, townPrice, ruralPrice, inspectionContent,
          coreMaintenanceContent, isActive
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          device.id, device.serialNumber, device.category,
          device.name, device.model, device.level, device.levelName,
          device.engineerLevel, device.deviceCount, device.unit,
          device.inspectionLaborFee, device.onSiteFeeAnnual,
          device.trafficFee, device.faultHandlingFeeTotal, device.cityPrice,
          device.year1TotalPrice, device.year2TotalPrice, device.year3TotalPrice,
          device.urbanPrice, device.townPrice, device.ruralPrice,
          device.inspectionContent, device.coreMaintenanceContent,
          device.isActive ? 1 : 0
        ]
      );
      inserted++;
    }

    return NextResponse.json({
      success: true,
      message: `成功导入 ${inserted} 条完整设备数据（含价格）！`,
      data: { inserted }
    });
  } catch (error) {
    console.error('导入失败:', error);
    return NextResponse.json(
      { success: false, error: '导入失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
