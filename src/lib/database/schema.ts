/**
 * 数据库表结构定义
 *
 * 从 db.ts 的 initDatabase() 提取，仅重组代码位置，不改变任何表结构。
 * migrations.ts 保持不动，不新增迁移版本号。
 */

import type Database from 'better-sqlite3';

/** 所有 CREATE TABLE 语句，按表分组 */
const SCHEMA_STATEMENTS: string[] = [
  // 客户表
  `CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    address TEXT,
    region TEXT DEFAULT '城区',
    level TEXT DEFAULT 'normal',
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 设备定额表（维保用）
  `CREATE TABLE IF NOT EXISTS device_quotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    specification TEXT,
    maintenance_tier TEXT DEFAULT 'C档',
    level TEXT DEFAULT 'B',
    engineer_level TEXT DEFAULT '初级',
    annual_fault_count REAL DEFAULT 0,
    a_gear_fault_count REAL DEFAULT 0,
    b_gear_fault_count REAL DEFAULT 0,
    c_gear_fault_count REAL DEFAULT 0,
    d_gear_fault_count REAL DEFAULT 0,
    e_gear_fault_count REAL DEFAULT 0,
    fault_processing_days REAL DEFAULT 0,
    inspection_days REAL DEFAULT 0,
    on_site_count INTEGER DEFAULT 0,
    inspection_labor_fee REAL DEFAULT 0,
    inspection_person_count INTEGER DEFAULT 1,
    inspection_duration REAL DEFAULT 0,
    inspection_times_per_year INTEGER DEFAULT 4,
    inspection_content TEXT,
    visit_service_fee REAL DEFAULT 0,
    visit_person_count INTEGER DEFAULT 1,
    visit_duration REAL DEFAULT 0,
    visit_frequency REAL DEFAULT 0,
    traffic_fee REAL DEFAULT 0,
    single_trip_duration REAL DEFAULT 0,
    connection_duration REAL DEFAULT 0,
    on_site_connection_labor_fee REAL DEFAULT 0,
    in_warranty_factor REAL DEFAULT 1.0,
    base_fault_count REAL DEFAULT 0,
    depreciation_factor REAL DEFAULT 1.0,
    fault_service_count REAL DEFAULT 0,
    fault_handler_count INTEGER DEFAULT 1,
    fault_handling_duration REAL DEFAULT 0,
    fault_handling_fee REAL DEFAULT 0,
    fault_handling_labor_fee REAL DEFAULT 0,
    fault_handling_material_fee REAL DEFAULT 0,
    tool_amortization REAL DEFAULT 0,
    tool_details TEXT,
    consumable_fee REAL DEFAULT 0,
    consumable_details TEXT,
    spare_part_reserve REAL DEFAULT 0,
    spare_part_fee REAL DEFAULT 0,
    spare_part_basis TEXT,
    city_price REAL DEFAULT 0,
    fault_handling_fee_total REAL DEFAULT 0,
    core_maintenance_content TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    unit TEXT DEFAULT '台',
    year1_total_price REAL DEFAULT 0,
    year2_total_price REAL DEFAULT 0,
    year3_total_price REAL DEFAULT 0,
    urban_price REAL DEFAULT 0,
    town_price REAL DEFAULT 0,
    rural_price REAL DEFAULT 0,
    fault_handling_fee_detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 工程报价表
  `CREATE TABLE IF NOT EXISTS engineering_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number TEXT UNIQUE NOT NULL,
    version INTEGER DEFAULT 1,
    project_name TEXT NOT NULL,
    client_id INTEGER,
    client_name TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    project_address TEXT,
    quote_date DATE,
    validity_days INTEGER DEFAULT 30,
    engineer_name TEXT,
    subtotal REAL DEFAULT 0,
    management_rate REAL DEFAULT 0.08,
    management_fee REAL DEFAULT 0,
    profit_rate REAL DEFAULT 0.10,
    profit REAL DEFAULT 0,
    regulatory_rate REAL DEFAULT 0.01,
    regulatory_fee REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0.13,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'draft',
    items TEXT,
    created_by TEXT,
    created_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 维保报价表
  `CREATE TABLE IF NOT EXISTS maintenance_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number TEXT UNIQUE NOT NULL,
    project_name TEXT NOT NULL,
    client_id INTEGER,
    client_name TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    project_address TEXT,
    quote_date DATE,
    validity_days INTEGER DEFAULT 30,
    engineer_name TEXT,
    engineer_level TEXT DEFAULT '中级',
    sla_coefficient REAL DEFAULT 1.0,
    region_coefficient REAL DEFAULT 1.0,
    years INTEGER DEFAULT 1,
    years_discount REAL DEFAULT 1.0,
    equipment_count INTEGER DEFAULT 0,
    bulk_discount REAL DEFAULT 1.0,
    total_inspection REAL DEFAULT 0,
    total_onsite REAL DEFAULT 0,
    total_repair REAL DEFAULT 0,
    total_tools REAL DEFAULT 0,
    total_consumables REAL DEFAULT 0,
    total_spare_parts REAL DEFAULT 0,
    subtotal_before_discount REAL DEFAULT 0,
    sla_adjustment REAL DEFAULT 0,
    region_adjustment REAL DEFAULT 0,
    subtotal_after_coefficients REAL DEFAULT 0,
    years_discount_amount REAL DEFAULT 0,
    bulk_discount_amount REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    devices TEXT,
    status TEXT DEFAULT 'draft',
    created_by TEXT,
    created_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 报价版本历史表
  `CREATE TABLE IF NOT EXISTS quote_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    quote_type TEXT NOT NULL,
    version INTEGER NOT NULL,
    data TEXT NOT NULL,
    change_summary TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 审核日志表
  `CREATE TABLE IF NOT EXISTS quote_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    quote_type TEXT NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    comment TEXT,
    operator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 自施工工序定额表
  `CREATE TABLE IF NOT EXISTS self_construction_quotas (
    id TEXT PRIMARY KEY,
    item_id TEXT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    price REAL NOT NULL,
    remark TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 集成商智能化项目定额表
  `CREATE TABLE IF NOT EXISTS intelligent_project_quotas (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    serial_number INTEGER,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    brand_model TEXT DEFAULT '',
    description TEXT,
    deductible_tax_rate REAL DEFAULT 0,
    unit TEXT NOT NULL,
    price REAL NOT NULL,
    remark TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 人工单价配置表
  `CREATE TABLE IF NOT EXISTS labor_price_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    unit_price REAL NOT NULL,
    unit TEXT DEFAULT '人天',
    description TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 维保设备定额表（云数据中心）
  `CREATE TABLE IF NOT EXISTS maintenance_device_quotas (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    model TEXT DEFAULT '',
    specification TEXT DEFAULT '',
    unit TEXT DEFAULT '台',
    quantity REAL DEFAULT 1,
    original_price REAL DEFAULT 0,
    maintenance_rate REAL DEFAULT 0,
    annual_fee REAL DEFAULT 0,
    network_type TEXT DEFAULT '内网',
    remark TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 维保费率配置表
  `CREATE TABLE IF NOT EXISTS maintenance_rate_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_type TEXT NOT NULL,
    rate REAL NOT NULL,
    description TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // SLA配置表
  `CREATE TABLE IF NOT EXISTS sla_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_name TEXT NOT NULL,
    inspection_frequency TEXT DEFAULT '',
    response_time TEXT DEFAULT '',
    fix_time TEXT DEFAULT '',
    on_site_time TEXT DEFAULT '',
    description TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 报价记录表
  `CREATE TABLE IF NOT EXISTS quotation_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    client_region TEXT,
    project_name TEXT,
    quote_type TEXT DEFAULT 'full',
    total_amount REAL DEFAULT 0,
    device_count INTEGER DEFAULT 0,
    quote_data TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  // 报价设备明细表
  `CREATE TABLE IF NOT EXISTS quotation_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    category TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    maintenance_rate REAL DEFAULT 0,
    maintenance_fee REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quotation_id) REFERENCES quotation_records(id)
  )`,

  // 智能体配置表
  `CREATE TABLE IF NOT EXISTS agent_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    system_prompt TEXT NOT NULL,
    model TEXT DEFAULT 'doubao-seed-1-8-251228',
    temperature REAL DEFAULT 0.7,
    enabled INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,

  // 智能体技能表
  `CREATE TABLE IF NOT EXISTS agent_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    skill_name TEXT NOT NULL,
    skill_type TEXT NOT NULL,
    config_json TEXT,
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agent_configs(id)
  )`,

  // 智能体会话表
  `CREATE TABLE IF NOT EXISTS agent_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    agent_id INTEGER,
    title TEXT DEFAULT '新对话',
    message_count INTEGER DEFAULT 0,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (agent_id) REFERENCES agent_configs(id)
  )`,

  // 智能体对话日志表
  `CREATE TABLE IF NOT EXISTS agent_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    agent_id INTEGER,
    session_id TEXT,
    user_message TEXT NOT NULL,
    agent_response TEXT NOT NULL,
    actions_executed TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (agent_id) REFERENCES agent_configs(id),
    FOREIGN KEY (session_id) REFERENCES agent_sessions(session_id)
  )`,

  // 智能体知识库表
  `CREATE TABLE IF NOT EXISTS agent_knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agent_configs(id)
  )`,

  // AI 模型配置表
  `CREATE TABLE IF NOT EXISTS ai_model_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    api_endpoint TEXT NOT NULL,
    api_key TEXT NOT NULL,
    temperature REAL DEFAULT 0.3,
    max_tokens INTEGER DEFAULT 3000,
    is_active INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    display_name TEXT,
    base_url TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    system_prompt TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // AI 学习记忆表
  `CREATE TABLE IF NOT EXISTS ai_learning_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    client_name TEXT,
    device_signature TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT,
    use_years INTEGER,
    unit_price REAL,
    quantity INTEGER,
    raw_data TEXT,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  )`,

  // AI 反馈表
  `CREATE TABLE IF NOT EXISTS ai_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_text TEXT NOT NULL,
    ai_result TEXT NOT NULL,
    corrected_result TEXT,
    feedback_type TEXT NOT NULL,
    feedback_comment TEXT,
    client_name TEXT,
    operator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 报价设备历史表
  `CREATE TABLE IF NOT EXISTS quote_device_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    client_name TEXT,
    device_signature TEXT NOT NULL,
    device_data TEXT,
    quote_total REAL,
    quote_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
];

/**
 * 执行所有 CREATE TABLE IF NOT EXISTS 语句。
 * 不改变表结构，仅确保表存在。
 */
export function createAllTables(db: Database.Database): void {
  for (const sql of SCHEMA_STATEMENTS) {
    db.exec(sql);
  }
}
