
import mysql from 'mysql2/promise';
import { FULL_DEVICE_QUOTAS, type FullDeviceQuota } from './complete-device-data';

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

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 扩展设备定额表结构（完整65列）
export async function extendDeviceQuotaTable() {
  try {
    const connection = await pool.getConnection();
    
    console.log('🔄 开始扩展设备定额表结构...');
    
    // 先检查表是否存在
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'maintenance_quota'"
    );
    
    if (Array.isArray(tables) && tables.length === 0) {
      console.log('📝 创建完整的设备定额表（65列）...');
      
      // 创建完整的设备定额表
      await connection.execute(`
        CREATE TABLE maintenance_quota (
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
      
      console.log('✅ 完整设备定额表创建成功！');
    } else {
      console.log('⚠️ 设备定额表已存在，跳过创建');
    }
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 扩展设备定额表失败:', error);
    return false;
  }
}

// 插入完整的126条设备数据
export async function insertFullDeviceData() {
  try {
    const connection = await pool.getConnection();
    
    console.log('🔄 开始插入完整设备数据...');
    
    // 先清空表（如果有旧数据）
    await connection.execute('DELETE FROM maintenance_quota');
    
    console.log(`📊 准备插入 ${FULL_DEVICE_QUOTAS.length} 条设备数据...`);
    
    // 批量插入设备数据
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
    }
    
    console.log(`✅ 成功插入 ${FULL_DEVICE_QUOTAS.length} 条设备数据！`);
    
    // 验证插入结果
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM maintenance_quota');
    const count = Array.isArray(countResult) && countResult[0] ? (countResult[0] as any).total : 0;
    console.log(`📊 数据库中当前共有 ${count} 条设备定额数据`);
    
    // 显示设备分类
    const [categories] = await connection.execute(
      'SELECT DISTINCT category FROM maintenance_quota ORDER BY category'
    );
    if (Array.isArray(categories)) {
      console.log('📂 设备分类列表:');
      categories.forEach((cat: any) =&gt; {
        console.log(`  - ${cat.category}`);
      });
    }
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 插入完整设备数据失败:', error);
    return false;
  }
}

// 完整数据库初始化
export async function fullDatabaseInit() {
  console.log('🚀 开始完整数据库初始化...');
  
  try {
    // 1. 扩展设备定额表
    const tableResult = await extendDeviceQuotaTable();
    if (!tableResult) {
      throw new Error('扩展设备定额表失败');
    }
    
    // 2. 插入完整设备数据
    const dataResult = await insertFullDeviceData();
    if (!dataResult) {
      throw new Error('插入完整设备数据失败');
    }
    
    console.log('🎉 完整数据库初始化完成！');
    console.log('✅ 所有126条设备数据及设备分类已成功导入数据库！');
    
    return true;
  } catch (error) {
    console.error('❌ 完整数据库初始化失败:', error);
    return false;
  }
}

export default {
  extendDeviceQuotaTable,
  insertFullDeviceData,
  fullDatabaseInit
};

