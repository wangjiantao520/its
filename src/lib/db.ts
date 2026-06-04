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
        status ENUM('draft', 'pending_review', 'approved', 'sent', 'archived') DEFAULT 'draft',
        items JSON,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_quote_number (quote_number),
        INDEX idx_client_id (client_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建维保报价表（扩展版本和审核功能）
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_number VARCHAR(50) UNIQUE NOT NULL,
        version INT DEFAULT 1,
        project_name VARCHAR(200) NOT NULL,
        client_id INT,
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
        status ENUM('draft', 'pending_review', 'approved', 'sent', 'archived') DEFAULT 'draft',
        devices JSON,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_quote_number (quote_number),
        INDEX idx_client_id (client_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建报价版本历史表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quote_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_id INT NOT NULL,
        quote_type ENUM('maintenance', 'engineering') NOT NULL,
        version INT NOT NULL,
        data JSON NOT NULL,
        change_summary TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_quote (quote_id, quote_type),
        INDEX idx_version (version),
        FOREIGN KEY (quote_id) REFERENCES maintenance_quotes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建审核日志表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quote_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quote_id INT NOT NULL,
        quote_type ENUM('maintenance', 'engineering') NOT NULL,
        action ENUM('create', 'submit_review', 'approve', 'reject', 'send', 'archive', 'update') NOT NULL,
        from_status VARCHAR(50),
        to_status VARCHAR(50),
        comment TEXT,
        operator VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_quote (quote_id, quote_type),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建分享链接表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quote_shares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(100) UNIQUE NOT NULL,
        quote_id INT NOT NULL,
        quote_type ENUM('maintenance', 'engineering') NOT NULL,
        expires_at TIMESTAMP,
        view_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_expires (expires_at)
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
