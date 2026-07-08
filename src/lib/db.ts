import mysql, { type RowDataPacket, type ResultSetHeader, type FieldPacket } from 'mysql2/promise';

// 数据库类型导出
export type DbRow = RowDataPacket;
export type DbRows = RowDataPacket[];
export type DbSelectResult = [RowDataPacket[], FieldPacket[]];
export type DbInsertResult = [ResultSetHeader, FieldPacket[]];

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
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

// 测试数据库连接
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    console.log('✅ 数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

// 初始化数据库表
export async function initDatabase() {
  try {
    const connection = await pool.getConnection();

    // 创建客户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(100),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(100),
        address TEXT,
        region VARCHAR(20) DEFAULT '城区',
        level ENUM('normal', 'vip', 'partner') DEFAULT 'normal',
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_client_code (client_code),
        INDEX idx_name (name),
        INDEX idx_level (level)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建设备定额表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS device_quotas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        brand VARCHAR(100),
        model VARCHAR(100),
        specification TEXT,
        maintenance_tier VARCHAR(10) DEFAULT 'C档',
        annual_fault_count DECIMAL(5,2),
        a_gear_fault_count DECIMAL(5,2),
        b_gear_fault_count DECIMAL(5,2),
        c_gear_fault_count DECIMAL(5,2),
        d_gear_fault_count DECIMAL(5,2),
        e_gear_fault_count DECIMAL(5,2),
        fault_processing_days DECIMAL(5,2),
        inspection_days DECIMAL(5,2),
        on_site_count INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建工程报价表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS engineering_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_number VARCHAR(50) UNIQUE NOT NULL,
        version INT DEFAULT 1,
        project_name VARCHAR(200) NOT NULL,
        client_id INT,
        client_name VARCHAR(100),
        contact_person VARCHAR(50),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(100),
        project_address TEXT,
        quote_date DATE,
        validity_days INT DEFAULT 30,
        engineer_name VARCHAR(50),
        subtotal DECIMAL(15,2) DEFAULT 0,
        management_rate DECIMAL(5,4) DEFAULT 0.08,
        management_fee DECIMAL(15,2) DEFAULT 0,
        profit_rate DECIMAL(5,4) DEFAULT 0.10,
        profit DECIMAL(15,2) DEFAULT 0,
        regulatory_rate DECIMAL(5,4) DEFAULT 0.01,
        regulatory_fee DECIMAL(15,2) DEFAULT 0,
        tax_rate DECIMAL(5,4) DEFAULT 0.13,
        tax DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        items JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_quote_number (quote_number),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建维保报价表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_number VARCHAR(50) UNIQUE NOT NULL,
        project_name VARCHAR(200) NOT NULL,
        client_id INT,
        client_name VARCHAR(100),
        contact_person VARCHAR(50),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(100),
        project_address TEXT,
        quote_date DATE,
        validity_days INT DEFAULT 30,
        engineer_name VARCHAR(50),
        engineer_level VARCHAR(20) DEFAULT '中级',
        sla_coefficient DECIMAL(5,2) DEFAULT 1.0,
        region_coefficient DECIMAL(5,2) DEFAULT 1.0,
        years INT DEFAULT 1,
        years_discount DECIMAL(5,4) DEFAULT 1.0,
        equipment_count INT DEFAULT 0,
        bulk_discount DECIMAL(5,4) DEFAULT 1.0,
        total_inspection DECIMAL(15,2) DEFAULT 0,
        total_onsite DECIMAL(15,2) DEFAULT 0,
        total_repair DECIMAL(15,2) DEFAULT 0,
        total_tools DECIMAL(15,2) DEFAULT 0,
        total_consumables DECIMAL(15,2) DEFAULT 0,
        total_spare_parts DECIMAL(15,2) DEFAULT 0,
        subtotal_before_discount DECIMAL(15,2) DEFAULT 0,
        sla_adjustment DECIMAL(15,2) DEFAULT 0,
        region_adjustment DECIMAL(15,2) DEFAULT 0,
        subtotal_after_coefficients DECIMAL(15,2) DEFAULT 0,
        years_discount_amount DECIMAL(15,2) DEFAULT 0,
        bulk_discount_amount DECIMAL(15,2) DEFAULT 0,
        subtotal DECIMAL(15,2) DEFAULT 0,
        tax DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) DEFAULT 0,
        devices JSON,
        status VARCHAR(20) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_quote_number (quote_number),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建报价版本历史表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quote_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_id INT NOT NULL,
        quote_type VARCHAR(20) NOT NULL,
        version INT NOT NULL,
        data JSON NOT NULL,
        change_summary TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_quote_id_type (quote_id, quote_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建审核日志表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quote_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_id INT NOT NULL,
        quote_type VARCHAR(20) NOT NULL,
        action VARCHAR(30) NOT NULL,
        from_status VARCHAR(50),
        to_status VARCHAR(50),
        comment TEXT,
        operator VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_quote_id_type (quote_id, quote_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建分享链接表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quote_shares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_id INT NOT NULL,
        share_token VARCHAR(64) UNIQUE NOT NULL,
        quote_type VARCHAR(20) NOT NULL,
        password VARCHAR(20) DEFAULT NULL,
        expires_at TIMESTAMP NULL DEFAULT NULL,
        max_views INT DEFAULT 0,
        view_count INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_share_token (share_token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建用户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'its',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建自施工工序定额表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS self_construction_quotas (
        id VARCHAR(20) PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        quantity DECIMAL(10,2) DEFAULT 1,
        price DECIMAL(15,2) NOT NULL,
        remark TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建集成商智能化项目定额表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS intelligent_project_quotas (
        id VARCHAR(20) PRIMARY KEY,
        serial_number INT NOT NULL,
        category VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        brand_model VARCHAR(200) DEFAULT '',
        description TEXT,
        deductible_tax_rate DECIMAL(5,2) DEFAULT 0,
        unit VARCHAR(20) NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        remark TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建人工单价配置表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS labor_price_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level VARCHAR(50) NOT NULL,
        unit_price DECIMAL(15,2) NOT NULL,
        unit VARCHAR(20) DEFAULT '人天',
        description VARCHAR(200) DEFAULT '',
        sort_order INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    connection.release();
    console.log('✅ 数据库表初始化完成');
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    return false;
  }
}

// 导出连接池
export { pool };
export default pool;
