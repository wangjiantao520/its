export interface MigrationTableSpec {
  name: string;
  columns: readonly string[];
  primaryKey: string;
  identity: boolean;
}

export const TABLE_COLUMNS = {
  users: ['id', 'username', 'password_hash', 'name', 'role', 'is_active', 'phone', 'email', 'created_at', 'updated_at', 'created_by'],
  auth_sessions: ['token_hash', 'role', 'user_id', 'username', 'name', 'expires_at', 'created_at', 'last_seen_at'],
  clients: ['id', 'client_code', 'name', 'contact_person', 'contact_phone', 'contact_email', 'address', 'region', 'level', 'remark', 'created_at', 'updated_at'],
  device_quotas: ['id', 'category', 'name', 'brand', 'model', 'specification', 'maintenance_tier', 'level', 'engineer_level', 'annual_fault_count', 'annual_failure_count', 'year_fault_rate', 'a_gear_fault_count', 'b_gear_fault_count', 'c_gear_fault_count', 'd_gear_fault_count', 'e_gear_fault_count', 'fault_processing_days', 'inspection_days', 'on_site_count', 'inspection_labor_fee', 'inspection_person_count', 'inspection_duration', 'inspection_times_per_year', 'inspection_content', 'visit_service_fee', 'visit_person_count', 'visit_duration', 'visit_frequency', 'traffic_fee', 'single_trip_duration', 'connection_duration', 'on_site_connection_labor_fee', 'in_warranty_factor', 'base_fault_count', 'depreciation_factor', 'fault_service_count', 'fault_handler_count', 'fault_handling_duration', 'fault_handling_fee', 'fault_handling_labor_fee', 'fault_handling_material_fee', 'tool_amortization', 'tool_details', 'consumable_fee', 'consumable_details', 'spare_part_reserve', 'spare_part_fee', 'spare_part_basis', 'city_price', 'fault_handling_fee_total', 'core_maintenance_content', 'sort_order', 'is_active', 'unit', 'year1_total_price', 'year2_total_price', 'year3_total_price', 'urban_price', 'town_price', 'rural_price', 'fault_handling_fee_detail', 'note', 'created_at', 'updated_at'],
  engineering_quotes: ['id', 'quote_number', 'version', 'project_name', 'client_id', 'client_name', 'contact_person', 'contact_phone', 'contact_email', 'project_address', 'construction_area', 'quote_date', 'validity_days', 'engineer_name', 'subtotal', 'management_rate', 'management_fee', 'profit_rate', 'profit', 'regulatory_rate', 'regulatory_fee', 'tax_rate', 'tax', 'total', 'status', 'items', 'created_by', 'created_by_name', 'created_at', 'updated_at'],
  maintenance_quotes: ['id', 'quote_number', 'version', 'project_name', 'client_id', 'client_name', 'contact_person', 'contact_phone', 'contact_email', 'project_address', 'quote_date', 'validity_days', 'engineer_name', 'engineer_level', 'sla_coefficient', 'region_coefficient', 'years', 'years_discount', 'equipment_count', 'bulk_discount', 'total_inspection', 'total_onsite', 'total_repair', 'total_tools', 'total_consumables', 'total_spare_parts', 'subtotal_before_discount', 'sla_adjustment', 'region_adjustment', 'subtotal_after_coefficients', 'years_discount_amount', 'bulk_discount_amount', 'subtotal', 'tax', 'total', 'devices', 'status', 'created_by', 'created_by_name', 'region', 'service_years', 'sla_config', 'created_at', 'updated_at'],
  quote_versions: ['id', 'quote_id', 'quote_type', 'version', 'data', 'change_summary', 'created_by', 'created_at'],
  quote_audit_logs: ['id', 'quote_id', 'quote_type', 'action', 'from_status', 'to_status', 'comment', 'operator', 'created_at'],
  quote_shares: ['id', 'token', 'quote_id', 'quote_type', 'password', 'expires_at', 'max_views', 'view_count', 'is_active', 'remark', 'created_at', 'updated_at'],
  self_construction_quotas: ['id', 'item_id', 'category', 'name', 'unit', 'quantity', 'price', 'remark', 'sort_order', 'created_at', 'updated_at'],
  intelligent_project_quotas: ['id', 'item_id', 'serial_number', 'category', 'name', 'brand_model', 'description', 'deductible_tax_rate', 'unit', 'price', 'remark', 'sort_order', 'created_at', 'updated_at'],
  labor_price_config: ['id', 'level', 'unit_price', 'unit', 'description', 'sort_order', 'is_active', 'created_at', 'updated_at'],
  maintenance_device_quotas: ['id', 'category', 'name', 'brand', 'model', 'specification', 'unit', 'quantity', 'original_price', 'maintenance_rate', 'annual_fee', 'network_type', 'remark', 'sort_order', 'is_active', 'created_at', 'updated_at'],
  maintenance_rate_config: ['id', 'device_type', 'rate', 'maintenance_rate', 'description', 'sort_order', 'is_active', 'created_at', 'updated_at'],
  sla_config: ['id', 'level_name', 'sla_level', 'inspection_frequency', 'response_time', 'resolution_time', 'fix_time', 'on_site_time', 'penalty_rate', 'description', 'sort_order', 'is_active', 'created_at', 'updated_at'],
  quotation_records: ['id', 'user_id', 'client_name', 'client_region', 'project_name', 'quote_type', 'total_amount', 'device_count', 'quote_data', 'status', 'created_at', 'updated_at'],
  quotation_devices: ['id', 'quotation_id', 'device_name', 'brand', 'model', 'category', 'quantity', 'unit_price', 'total_price', 'maintenance_rate', 'maintenance_fee', 'created_at'],
  agent_configs: ['id', 'name', 'description', 'system_prompt', 'model', 'temperature', 'enabled', 'created_by', 'created_at', 'updated_at'],
  agent_skills: ['id', 'agent_id', 'skill_name', 'skill_type', 'config_json', 'enabled', 'priority', 'created_at'],
  agent_sessions: ['id', 'session_id', 'user_id', 'user_name', 'agent_id', 'agent_name', 'title', 'last_message', 'message_count', 'last_message_at', 'created_at', 'updated_at', 'is_deleted'],
  agent_logs: ['id', 'user_id', 'agent_id', 'session_id', 'user_message', 'agent_response', 'actions_executed', 'created_at'],
  agent_knowledge_base: ['id', 'agent_id', 'title', 'content', 'category', 'tags', 'created_at'],
  ai_model_configs: ['id', 'name', 'provider', 'model_name', 'api_endpoint', 'api_key', 'temperature', 'max_tokens', 'system_prompt', 'description', 'is_active', 'is_default', 'sort_order', 'created_by', 'display_name', 'base_url', 'created_at', 'updated_at'],
  ai_model_logs: ['id', 'config_id', 'provider', 'model_name', 'request_type', 'prompt_length', 'response_length', 'status', 'duration_ms', 'error_message', 'created_at'],
  ai_learning_memory: ['id', 'client_id', 'client_name', 'device_signature', 'device_name', 'device_type', 'use_years', 'unit_price', 'quantity', 'raw_data', 'device_config', 'usage_count', 'last_used_at', 'created_at'],
  ai_feedback: ['id', 'original_text', 'ai_result', 'corrected_result', 'feedback_type', 'feedback_comment', 'client_name', 'operator', 'created_at'],
  quote_device_history: ['id', 'client_id', 'client_name', 'device_signature', 'device_data', 'quote_total', 'quote_id', 'quote_type', 'created_at'],
  quote_library: ['id', 'user_id', 'title', 'client_name', 'project_name', 'project_description', 'quote_data', 'total_amount', 'currency', 'is_published', 'created_at', 'updated_at'],
  quote_library_attachments: ['id', 'library_id', 'category', 'original_name', 'stored_path', 'mime_type', 'file_size', 'uploaded_by', 'created_at'],
  sqlite_import_runs: ['import_id', 'source_fingerprint', 'status', 'source_integrity', 'backup_integrity', 'backup_path', 'target_migration_versions', 'imported_counts', 'report_json', 'started_at', 'completed_at'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type MigrationTableName = keyof typeof TABLE_COLUMNS;

const NON_IDENTITY_TABLES = new Set<MigrationTableName>([
  'auth_sessions',
  'self_construction_quotas',
  'intelligent_project_quotas',
  'maintenance_device_quotas',
]);

const PRIMARY_KEYS: Readonly<Record<MigrationTableName, string>> = Object.fromEntries(
  Object.keys(TABLE_COLUMNS).map((name) => [name, name === 'auth_sessions' ? 'token_hash' : 'id']),
) as Readonly<Record<MigrationTableName, string>>;

export const MIGRATION_TABLES: readonly MigrationTableSpec[] = Object.entries(TABLE_COLUMNS)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, columns]) => ({
    name,
    columns,
    primaryKey: PRIMARY_KEYS[name as MigrationTableName],
    identity: !NON_IDENTITY_TABLES.has(name as MigrationTableName),
  }));

export const TABLE_BY_NAME = new Map(MIGRATION_TABLES.map((table) => [table.name, table]));

export const MIGRATION_GROUPS = [
  ['users', 'clients', 'device_quotas', 'self_construction_quotas', 'intelligent_project_quotas', 'labor_price_config', 'maintenance_device_quotas', 'maintenance_rate_config', 'sla_config', 'ai_model_configs', 'ai_feedback'],
  ['auth_sessions', 'engineering_quotes', 'maintenance_quotes', 'quotation_records', 'agent_configs', 'ai_model_logs', 'ai_learning_memory', 'quote_device_history'],
  ['quote_versions', 'quote_audit_logs', 'quote_shares', 'quotation_devices', 'agent_skills', 'agent_sessions', 'agent_knowledge_base'],
  ['agent_logs'],
] as const satisfies readonly (readonly MigrationTableName[])[];

// Reserved for SQLite import serialization; distinct from migration lock 49375483.
export const SQLITE_IMPORT_ADVISORY_LOCK_ID = 49375484;

export const BOOLEAN_COLUMNS = new Set([
  'users.is_active', 'device_quotas.is_active', 'quote_shares.is_active',
  'labor_price_config.is_active', 'maintenance_device_quotas.is_active',
  'maintenance_rate_config.is_active', 'sla_config.is_active', 'agent_configs.enabled',
  'agent_skills.enabled', 'agent_sessions.is_deleted', 'ai_model_configs.is_active',
  'ai_model_configs.is_default',
]);

export const MONEY_COLUMNS = new Set([
  'device_quotas.inspection_labor_fee', 'device_quotas.visit_service_fee',
  'device_quotas.traffic_fee', 'device_quotas.on_site_connection_labor_fee',
  'device_quotas.fault_handling_fee', 'device_quotas.fault_handling_labor_fee',
  'device_quotas.fault_handling_material_fee', 'device_quotas.tool_amortization',
  'device_quotas.consumable_fee', 'device_quotas.spare_part_reserve',
  'device_quotas.spare_part_fee', 'device_quotas.city_price',
  'device_quotas.fault_handling_fee_total', 'device_quotas.year1_total_price',
  'device_quotas.year2_total_price', 'device_quotas.year3_total_price',
  'device_quotas.urban_price', 'device_quotas.town_price', 'device_quotas.rural_price',
  'engineering_quotes.subtotal', 'engineering_quotes.management_fee',
  'engineering_quotes.profit', 'engineering_quotes.regulatory_fee',
  'engineering_quotes.tax', 'engineering_quotes.total',
  'maintenance_quotes.total_inspection', 'maintenance_quotes.total_onsite',
  'maintenance_quotes.total_repair', 'maintenance_quotes.total_tools',
  'maintenance_quotes.total_consumables', 'maintenance_quotes.total_spare_parts',
  'maintenance_quotes.subtotal_before_discount', 'maintenance_quotes.sla_adjustment',
  'maintenance_quotes.region_adjustment', 'maintenance_quotes.subtotal_after_coefficients',
  'maintenance_quotes.years_discount_amount', 'maintenance_quotes.bulk_discount_amount',
  'maintenance_quotes.subtotal', 'maintenance_quotes.tax', 'maintenance_quotes.total',
  'self_construction_quotas.price', 'intelligent_project_quotas.price',
  'labor_price_config.unit_price', 'maintenance_device_quotas.original_price',
  'maintenance_device_quotas.annual_fee', 'quotation_records.total_amount',
  'quotation_devices.unit_price', 'quotation_devices.total_price',
  'quotation_devices.maintenance_fee', 'ai_learning_memory.unit_price',
  'quote_device_history.quote_total',
]);

export const JSON_COLUMNS = new Set([
  'engineering_quotes.items', 'maintenance_quotes.devices', 'maintenance_quotes.sla_config',
  'quote_versions.data', 'quotation_records.quote_data', 'agent_skills.config_json',
  'agent_logs.actions_executed', 'ai_learning_memory.raw_data',
  'ai_learning_memory.device_config', 'ai_feedback.ai_result',
  'ai_feedback.corrected_result', 'quote_device_history.device_data',
]);

export const NULLABLE_TEMPORAL_COLUMNS = new Set([
  'engineering_quotes.quote_date', 'maintenance_quotes.quote_date', 'quote_shares.expires_at',
]);

export const NON_NULL_TEMPORAL_COLUMNS = new Set(
  MIGRATION_TABLES.flatMap(({ name, columns }) => columns
    .filter((column) => column === 'created_at' || column === 'updated_at'
      || column === 'last_seen_at' || column === 'last_message_at'
      || column === 'last_used_at')
    .map((column) => `${name}.${column}`)),
);

export const TIMESTAMP_COLUMNS = new Set([
  ...NON_NULL_TEMPORAL_COLUMNS,
  'quote_shares.expires_at',
]);

export const SOURCE_METADATA_TABLES = new Set(['schema_migrations']);
export const OBSOLETE_TABLE = 'ai_models';
export const LEGACY_IGNORED_SOURCE_COLUMNS: Readonly<Record<string, ReadonlySet<string>>> = {
  ai_model_configs: new Set(['enabled']),
};
export const LEGACY_ITEM_PRIMARY_KEY_TABLES = new Set([
  'self_construction_quotas',
  'intelligent_project_quotas',
]);

export const CRITICAL_FOREIGN_KEYS = [
  ['auth_sessions', 'user_id', 'users', 'id'],
  ['engineering_quotes', 'client_id', 'clients', 'id'],
  ['maintenance_quotes', 'client_id', 'clients', 'id'],
  ['quotation_records', 'user_id', 'users', 'id'],
  ['quotation_devices', 'quotation_id', 'quotation_records', 'id'],
  ['agent_configs', 'created_by', 'users', 'id'],
  ['agent_skills', 'agent_id', 'agent_configs', 'id'],
  ['agent_sessions', 'user_id', 'users', 'id'],
  ['agent_sessions', 'agent_id', 'agent_configs', 'id'],
  ['agent_logs', 'user_id', 'users', 'id'],
  ['agent_logs', 'agent_id', 'agent_configs', 'id'],
  ['agent_logs', 'session_id', 'agent_sessions', 'session_id'],
  ['agent_knowledge_base', 'agent_id', 'agent_configs', 'id'],
  ['ai_model_logs', 'config_id', 'ai_model_configs', 'id'],
  ['ai_learning_memory', 'client_id', 'clients', 'id'],
  ['quote_device_history', 'client_id', 'clients', 'id'],
] as const;

export const POLYMORPHIC_QUOTE_TABLES = [
  'quote_versions',
  'quote_shares',
  'quote_audit_logs',
  'quote_device_history',
] as const;

export function polymorphicOrphanKey(table: string): string {
  return `${table}.quote_id+quote_type->engineering_quotes|maintenance_quotes`;
}

export function quoteIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) throw new Error('Unsafe database identifier.');
  return `"${identifier}"`;
}
