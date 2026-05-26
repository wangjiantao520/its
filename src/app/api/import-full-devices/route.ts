
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { FULL_DEVICE_QUOTAS, getDeviceCategories, getDeviceStats } from '@/lib/complete-device-data';

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quotation_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

export async function GET() {
  try {
    const pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    
    console.log('🚀 开始导入完整设备数据...');
    
    // 1. 先创建完整的设备定额表（如果不存在）
    console.log('📋 检查并创建设备定额表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_quota (
        id VARCHAR(100) PRIMARY KEY,
        serial_number INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100),
        name VARCHAR(200) NOT NULL,
        brand VARCHAR(100),
        model VARCHAR(200) NOT NULL,
        specification TEXT,
        unit VARCHAR(20) NOT NULL,
        
        level VARCHAR(10) NOT NULL,
        level_name VARCHAR(50) NOT NULL,
        engineer_level VARCHAR(20),
        level_description TEXT,
        
        inspection_labor_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        inspection_person_count INT NOT NULL DEFAULT 1,
        inspection_duration INT NOT NULL DEFAULT 0,
        inspection_times_per_year INT NOT NULL DEFAULT 4,
        inspection_content TEXT,
        inspection_fee_annual DECIMAL(10,2) NOT NULL DEFAULT 0,
        
        traffic_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        single_trip_duration INT NOT NULL DEFAULT 0,
        connection_duration INT NOT NULL DEFAULT 0,
        on_site_connection_labor_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        on_site_fee_annual DECIMAL(10,2) NOT NULL DEFAULT 0,
        
        in_warranty_factor DECIMAL(3,2) NOT NULL DEFAULT 1.0,
        base_fault_count DECIMAL(5,2) NOT NULL DEFAULT 1.0,
        depreciation_factor DECIMAL(3,2) NOT NULL DEFAULT 0.6,
        fault_service_count DECIMAL(5,2) NOT NULL DEFAULT 1.0,
        fault_handler_count INT NOT NULL DEFAULT 1,
        fault_handling_duration INT NOT NULL DEFAULT 0,
        fault_handling_labor_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        fault_handling_fee_total DECIMAL(10,2) NOT NULL DEFAULT 0,
        
        tool_amortization DECIMAL(10,2) NOT NULL DEFAULT 0,
        tool_details TEXT,
        
        consumable_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        consumable_details TEXT,
        
        spare_part_reserve DECIMAL(10,2) NOT NULL DEFAULT 0,
        spare_part_basis TEXT,
        
        core_maintenance_content TEXT,
        maintenance_scope TEXT,
        special_requirements TEXT,
        
        city_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        urban_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        town_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        rural_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        
        inspection_fee_detail DECIMAL(10,2) NOT NULL DEFAULT 0,
        on_site_fee_detail DECIMAL(10,2) NOT NULL DEFAULT 0,
        fault_handling_fee_detail DECIMAL(10,2) NOT NULL DEFAULT 0,
        tool_fee_detail DECIMAL(10,2) NOT NULL DEFAULT 0,
        consumable_fee_detail DECIMAL(10,2) NOT NULL DEFAULT 0,
        spare_part_fee_detail DECIMAL(10,2) NOT NULL DEFAULT 0,
        
        remarks TEXT,
        is_active TINYINT(1) DEFAULT 1,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        data_source VARCHAR(100),
        
        INDEX idx_category (category),
        INDEX idx_level (level),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    
    console.log('✅ 设备定额表检查/创建成功！');
    
    // 2. 清空旧数据
    console.log('🗑️  清空旧的设备数据...');
    await connection.execute('DELETE FROM maintenance_quota');
    
    // 3. 插入完整数据
    console.log(`📊 准备插入 ${FULL_DEVICE_QUOTAS.length} 条设备数据...`);
    
    let successCount = 0;
    for (const device of FULL_DEVICE_QUOTAS) {
      await connection.execute(`
        INSERT INTO maintenance_quota (
          id, serial_number, category, sub_category, name, brand, model, specification, unit,
          level, level_name, engineer_level, level_description,
          inspection_labor_fee, inspection_person_count, inspection_duration, 
          inspection_times_per_year, inspection_content, inspection_fee_annual,
          traffic_fee, single_trip_duration, connection_duration, 
          on_site_connection_labor_fee, on_site_fee_annual,
          in_warranty_factor, base_fault_count, depreciation_factor, 
          fault_service_count, fault_handler_count, fault_handling_duration, 
          fault_handling_labor_fee, fault_handling_fee_total,
          tool_amortization, tool_details,
          consumable_fee, consumable_details,
          spare_part_reserve, spare_part_basis,
          core_maintenance_content, maintenance_scope, special_requirements,
          city_price, urban_price, town_price, rural_price,
          inspection_fee_detail, on_site_fee_detail, fault_handling_fee_detail,
          tool_fee_detail, consumable_fee_detail, spare_part_fee_detail,
          remarks, is_active, data_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        device.id,
        device.serialNumber,
        device.category,
        device.subCategory || null,
        device.name,
        device.brand || null,
        device.model,
        device.specification || null,
        device.unit,
        device.level,
        device.levelName,
        device.engineerLevel,
        device.levelDescription || null,
        device.inspectionLaborFee,
        device.inspectionPersonCount,
        device.inspectionDuration,
        device.inspectionTimesPerYear,
        device.inspectionContent,
        device.inspectionFeeAnnual,
        device.trafficFee,
        device.singleTripDuration,
        device.connectionDuration,
        device.onSiteConnectionLaborFee,
        device.onSiteFeeAnnual,
        device.inWarrantyFactor,
        device.baseFaultCount,
        device.depreciationFactor,
        device.faultServiceCount,
        device.faultHandlerCount,
        device.faultHandlingDuration,
        device.faultHandlingLaborFee,
        device.faultHandlingFeeTotal,
        device.toolAmortization,
        device.toolDetails,
        device.consumableFee,
        device.consumableDetails,
        device.sparePartReserve,
        device.sparePartBasis,
        device.coreMaintenanceContent,
        device.maintenanceScope || null,
        device.specialRequirements || null,
        device.cityPrice,
        device.urbanPrice,
        device.townPrice,
        device.ruralPrice,
        device.inspectionFeeDetail,
        device.onSiteFeeDetail,
        device.faultHandlingFeeDetail,
        device.toolFeeDetail,
        device.consumableFeeDetail,
        device.sparePartFeeDetail,
        device.remarks || null,
        device.isActive ? 1 : 0,
        device.dataSource || '政企设备维保定额库_2026'
      ]);
      successCount++;
    }
    
    console.log(`✅ 成功插入 ${successCount} 条设备数据！`);
    
    // 4. 查询统计
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM maintenance_quota');
    const count = Array.isArray(countResult) &amp;&amp; countResult[0] ? (countResult[0] as any).total : 0;
    
    const [categories] = await connection.execute(
      'SELECT DISTINCT category FROM maintenance_quota ORDER BY category'
    );
    
    connection.release();
    
    const stats = getDeviceStats();
    const categoriesList = getDeviceCategories();
    
    console.log('🎉 完整设备数据导入完成！');
    
    return NextResponse.json({
      success: true,
      message: `成功导入 ${successCount} 条设备数据！`,
      data: {
        total: count,
        categories: categoriesList,
        stats: stats
      }
    });
    
  } catch (error) {
    console.error('❌ 导入设备数据失败:', error);
    return NextResponse.json({
      success: false,
      message: '导入设备数据失败',
      error: String(error)
    }, { status: 500 });
  }
}

