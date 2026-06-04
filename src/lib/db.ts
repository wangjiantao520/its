import mysql from 'mysql2/promise';

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

// 测试数据库连接
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
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

    // 创建工程报价表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS engineering_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_number VARCHAR(50) UNIQUE NOT NULL,
        project_name VARCHAR(200) NOT NULL,
        client_name VARCHAR(100),
        contact_person VARCHAR(50),
        contact_phone VARCHAR(20),
        construction_area DECIMAL(10,2),
        management_rate DECIMAL(5,2) DEFAULT 8.00,
        profit_rate DECIMAL(5,2) DEFAULT 5.00,
        regulatory_rate DECIMAL(5,2) DEFAULT 6.00,
        tax_rate DECIMAL(5,2) DEFAULT 9.00,
        subtotal DECIMAL(15,2) DEFAULT 0,
        management_fee DECIMAL(15,2) DEFAULT 0,
        profit DECIMAL(15,2) DEFAULT 0,
        regulatory_fee DECIMAL(15,2) DEFAULT 0,
        tax DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        items JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_quote_number (quote_number),
        INDEX idx_created_at (created_at),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建维保报价表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_number VARCHAR(50) UNIQUE NOT NULL,
        project_name VARCHAR(200) NOT NULL,
        client_name VARCHAR(100),
        contact_person VARCHAR(50),
        contact_phone VARCHAR(20),
        region VARCHAR(20) DEFAULT '城区',
        service_years INT DEFAULT 1,
        engineer_level VARCHAR(10) DEFAULT '中级',
        sla_config JSON,
        subtotal_before_discount DECIMAL(15,2) DEFAULT 0,
        sla_adjustment DECIMAL(15,2) DEFAULT 0,
        region_adjustment DECIMAL(15,2) DEFAULT 0,
        subtotal_after_coefficients DECIMAL(15,2) DEFAULT 0,
        years_discount DECIMAL(5,2) DEFAULT 1.00,
        bulk_discount DECIMAL(5,2) DEFAULT 1.00,
        years_discount_amount DECIMAL(15,2) DEFAULT 0,
        bulk_discount_amount DECIMAL(15,2) DEFAULT 0,
        tax DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) DEFAULT 0,
        devices JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_quote_number (quote_number),
        INDEX idx_created_at (created_at)
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
        INDEX idx_category (category),
        INDEX idx_name (name)
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
        INDEX idx_category (category),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建人工单价配置表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS labor_price_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level VARCHAR(50) NOT NULL COMMENT '人员等级',
        unit_price DECIMAL(15,2) NOT NULL COMMENT '人天单价',
        unit VARCHAR(20) DEFAULT '人天' COMMENT '单位',
        description VARCHAR(200) DEFAULT '' COMMENT '说明',
        sort_order INT DEFAULT 0 COMMENT '排序',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_level (level),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 初始化默认人工单价档位
    const [existingLabor] = await connection.execute('SELECT COUNT(*) as cnt FROM labor_price_config');
    if ((existingLabor as any[])[0].cnt === 0) {
      await connection.execute(`
        INSERT INTO labor_price_config (level, unit_price, unit, description, sort_order) VALUES
        ('初级', 200.00, '人天', '初级工程师', 1),
        ('中级', 300.00, '人天', '中级工程师', 2),
        ('高级', 400.00, '人天', '高级工程师', 3),
        ('专家', 500.00, '人天', '专家级工程师', 4)
      `);
    }

    // 创建报价分享记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quote_shares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_id INT NOT NULL,
        share_token VARCHAR(64) UNIQUE NOT NULL,
        password VARCHAR(20) DEFAULT NULL,
        expires_at TIMESTAMP NULL DEFAULT NULL,
        max_views INT DEFAULT 0,
        view_count INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_share_token (share_token),
        INDEX idx_quote_id (quote_id),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ 数据库表初始化成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    return false;
  }
}

export default pool;
