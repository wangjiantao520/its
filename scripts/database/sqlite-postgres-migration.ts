import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

import type { DatabaseClient } from '../../src/lib/database/client';
import {
  runPostgresMigrations,
  type PostgresMigrationResult,
} from '../../src/lib/database/postgres-migrations';

type SqlitePrimitive = bigint | number | string | null;
type SqliteRow = Record<string, SqlitePrimitive>;

interface SqliteStatement {
  all(...params: readonly unknown[]): SqliteRow[];
  get(...params: readonly unknown[]): SqliteRow | undefined;
  run(...params: readonly unknown[]): unknown;
  setReadBigInts?(enabled: boolean): void;
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (
    filename: string,
    options?: { open?: boolean; readOnly?: boolean; enableForeignKeyConstraints?: boolean },
  ) => SqliteDatabase;
}

export interface MigrationTableSpec {
  name: string;
  columns: readonly string[];
  primaryKey: string;
  identity: boolean;
}

const TABLE_COLUMNS = {
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
} as const satisfies Readonly<Record<string, readonly string[]>>;

type MigrationTableName = keyof typeof TABLE_COLUMNS;

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

const TABLE_BY_NAME = new Map(MIGRATION_TABLES.map((table) => [table.name, table]));

export const MIGRATION_GROUPS = [
  ['users', 'clients', 'device_quotas', 'self_construction_quotas', 'intelligent_project_quotas', 'labor_price_config', 'maintenance_device_quotas', 'maintenance_rate_config', 'sla_config', 'ai_model_configs', 'ai_feedback'],
  ['auth_sessions', 'engineering_quotes', 'maintenance_quotes', 'quotation_records', 'agent_configs', 'ai_model_logs', 'ai_learning_memory', 'quote_device_history'],
  ['quote_versions', 'quote_audit_logs', 'quote_shares', 'quotation_devices', 'agent_skills', 'agent_sessions', 'agent_knowledge_base'],
  ['agent_logs'],
] as const satisfies readonly (readonly MigrationTableName[])[];

// Reserved for SQLite import serialization; distinct from migration lock 49375483.
export const SQLITE_IMPORT_ADVISORY_LOCK_ID = 49375484;

const BOOLEAN_COLUMNS = new Set([
  'users.is_active', 'device_quotas.is_active', 'quote_shares.is_active',
  'labor_price_config.is_active', 'maintenance_device_quotas.is_active',
  'maintenance_rate_config.is_active', 'sla_config.is_active', 'agent_configs.enabled',
  'agent_skills.enabled', 'agent_sessions.is_deleted', 'ai_model_configs.is_active',
  'ai_model_configs.is_default',
]);

const MONEY_COLUMNS = new Set([
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

const JSON_COLUMNS = new Set([
  'engineering_quotes.items', 'maintenance_quotes.devices', 'maintenance_quotes.sla_config',
  'quote_versions.data', 'quotation_records.quote_data', 'agent_skills.config_json',
  'agent_logs.actions_executed', 'ai_learning_memory.raw_data',
  'ai_learning_memory.device_config', 'ai_feedback.ai_result',
  'ai_feedback.corrected_result', 'quote_device_history.device_data',
]);

const NULLABLE_TEMPORAL_COLUMNS = new Set([
  'engineering_quotes.quote_date', 'maintenance_quotes.quote_date', 'quote_shares.expires_at',
]);

const NON_NULL_TEMPORAL_COLUMNS = new Set(
  MIGRATION_TABLES.flatMap(({ name, columns }) => columns
    .filter((column) => column === 'created_at' || column === 'updated_at'
      || column === 'last_seen_at' || column === 'last_message_at'
      || column === 'last_used_at')
    .map((column) => `${name}.${column}`)),
);

const TIMESTAMP_COLUMNS = new Set([
  ...NON_NULL_TEMPORAL_COLUMNS,
  'quote_shares.expires_at',
]);

const SOURCE_METADATA_TABLES = new Set(['schema_migrations']);
const OBSOLETE_TABLE = 'ai_models';
const LEGACY_ITEM_PRIMARY_KEY_TABLES = new Set([
  'self_construction_quotas',
  'intelligent_project_quotas',
]);

export interface PrimaryKeyRange {
  min: string | null;
  max: string | null;
}

export interface TableSummary {
  count: number;
  primaryKey: PrimaryKeyRange | null;
}

export interface QuoteAggregateSummary {
  count: number;
  subtotal: string;
  tax: string;
  total: string;
}

export interface VerificationUser {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  passwordHash?: string;
  passwordHashMatches?: boolean;
}

export interface MigrationSummary {
  tables: Record<string, TableSummary>;
  aggregates: {
    engineering_quotes: QuoteAggregateSummary;
    maintenance_quotes: QuoteAggregateSummary;
  };
  users: VerificationUser[];
  authTokenHashes?: string[];
  orphans: Record<string, number>;
  normalizations: Record<string, number>;
  ignoredSourceTables: string[];
}

export interface MigrationSnapshot {
  rows: Record<string, SqliteRow[]>;
  sourceColumns: Record<string, string[]>;
  ignoredSourceTables: string[];
  summary: MigrationSummary;
}

export interface PreparedSqliteSource {
  sourceIntegrity: 'ok';
  backupIntegrity: 'ok';
  backupPath: string;
  baseline: MigrationSummary;
}

export interface PrepareSqliteOptions {
  backupDirectory?: string;
  now?: Date;
}

export interface ImportResult {
  importedCounts: Record<string, number>;
  identities: Record<string, { reset: boolean }>;
}

export interface DatabaseImportReport {
  success: true;
  importId: string;
  sourceFingerprint: string;
  backupPath: string;
  sourceIntegrity: 'ok';
  backupIntegrity: 'ok';
  targetMigrationVersions: number[];
  baseline: Pick<MigrationSummary, 'tables' | 'aggregates' | 'normalizations' | 'ignoredSourceTables'>;
  importedCounts: Record<string, number>;
  verification: MigrationVerificationReport;
  startTime: string;
  endTime: string;
}

export interface IdentityVerification {
  sequenceValue: string | null;
  maxId: string | null;
  safe: boolean;
}

export interface MigrationVerificationReport {
  success: boolean;
  tables: Record<string, {
    sourceCount: number;
    targetCount: number;
    countMatches: boolean;
    sourcePrimaryKey: PrimaryKeyRange | null;
    targetPrimaryKey: PrimaryKeyRange | null;
    primaryKeyMatches: boolean;
  }>;
  aggregates: Record<string, {
    source: QuoteAggregateSummary;
    target: QuoteAggregateSummary;
    matches: boolean;
  }>;
  users: Array<{
    id: string;
    username: string;
    usernameMatches: boolean;
    roleMatches: boolean;
    activeMatches: boolean;
    passwordHashMatches: boolean;
  }>;
  authSessionTokenHashesMatch: boolean;
  orphans: Record<string, { source: number; target: number; matches: boolean }>;
  identities: Record<string, IdentityVerification>;
  ignoredSourceTables: string[];
}

export class MigrationVerificationError extends Error {
  readonly report: MigrationVerificationReport;

  constructor(report: MigrationVerificationReport) {
    super('Database migration verification failed.');
    this.name = 'MigrationVerificationError';
    this.report = report;
  }
}

export interface MigrateSqliteDatabaseOptions {
  sourcePath: string;
  client: DatabaseClient;
  allowNonemptyTarget?: boolean;
  backupDirectory?: string;
  now?: Date;
  runMigrations?: (client: DatabaseClient) => Promise<PostgresMigrationResult>;
  validateTargetSchema?: (client: DatabaseClient) => Promise<void>;
  verifyMigration?: typeof verifyDatabaseMigration;
}

function loadNodeSqlite(): NodeSqliteModule {
  try {
    return createRequire(import.meta.url)('node:sqlite') as NodeSqliteModule;
  } catch {
    throw new Error('Node SQLite is unavailable. Run this tool with Node 22/24 and --experimental-sqlite when required.');
  }
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) throw new Error('Unsafe database identifier.');
  return `"${identifier}"`;
}

function openSqliteReadOnly(filename: string): SqliteDatabase {
  const { DatabaseSync } = loadNodeSqlite();
  return new DatabaseSync(filename, { readOnly: true, enableForeignKeyConstraints: true });
}

function allRows(database: SqliteDatabase, sql: string, params: readonly unknown[] = []): SqliteRow[] {
  const statement = database.prepare(sql);
  statement.setReadBigInts?.(true);
  return statement.all(...params);
}

function scalarCount(database: SqliteDatabase, table: string): number {
  const row = allRows(database, `SELECT count(*) AS count FROM ${quoteIdentifier(table)}`)[0];
  return Number(row?.count ?? 0);
}

function integrityCheck(database: SqliteDatabase): 'ok' {
  const results = allRows(database, 'PRAGMA integrity_check');
  if (results.length !== 1 || results[0]?.integrity_check !== 'ok') {
    throw new Error('SQLite integrity check failed.');
  }
  return 'ok';
}

function listSourceTables(database: SqliteDatabase): string[] {
  return allRows(
    database,
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).map(({ name }) => String(name));
}

function listColumns(database: SqliteDatabase, table: string): string[] {
  return allRows(database, `PRAGMA table_info(${quoteIdentifier(table)})`)
    .map(({ name }) => String(name));
}

function safePrimitive(value: SqlitePrimitive): SqlitePrimitive {
  if (typeof value !== 'bigint') return value;
  if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return value.toString();
}

function normalizeRow(row: SqliteRow): SqliteRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, safePrimitive(value)]));
}

function normalizeLegacyPrimaryKeys(table: string, rows: SqliteRow[]): SqliteRow[] {
  if (!LEGACY_ITEM_PRIMARY_KEY_TABLES.has(table)) return rows;
  const keys = new Set<string>();
  return rows.map((row) => {
    const primaryKey = row.id === null || row.id === '' ? row.item_id : row.id;
    if (primaryKey === null || primaryKey === undefined || primaryKey === '') {
      throw new Error(`Source table ${table} has a row without an id or item_id.`);
    }
    const key = String(primaryKey);
    if (keys.has(key)) throw new Error(`Source table ${table} has duplicate effective primary keys.`);
    keys.add(key);
    return { ...row, id: key };
  });
}

const NUMERIC_18_2_MAX_CENTS = BigInt('999999999999999999');

function decimalToNumeric18_2Cents(value: Exclude<SqlitePrimitive, null>): bigint {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('numeric(18,2) requires a finite numeric value.');
  }
  const text = String(value).trim();
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new Error('numeric(18,2) requires a valid decimal value.');

  const negative = match[1] === '-';
  const integerPart = match[2] ?? '0';
  const fractionPart = match[3] ?? match[4] ?? '';
  const exponentText = match[5] ?? '0';
  if (exponentText.length > 6) {
    throw new Error(exponentText.startsWith('-')
      ? 'numeric(18,2) source scale exceeds the supported limit.'
      : 'numeric(18,2) value is out of range.');
  }
  const exponent = Number.parseInt(exponentText, 10);
  let digits = `${integerPart}${fractionPart}`.replace(/^0+/, '') || '0';
  let scale = fractionPart.length - exponent;

  if (digits === '0') return BigInt(0);
  while (scale > 0 && digits.endsWith('0')) {
    digits = digits.slice(0, -1);
    scale -= 1;
  }
  if (scale > 18) {
    throw new Error('numeric(18,2) source scale exceeds the supported limit.');
  }
  const wholeDigits = Math.max(0, digits.length - scale);
  if (wholeDigits > 16 || scale < -16) {
    throw new Error('numeric(18,2) value is out of range.');
  }
  if (scale < 0) {
    digits = `${digits}${'0'.repeat(-scale)}`;
    scale = 0;
  }

  const coefficient = BigInt(digits);
  let cents: bigint;
  if (scale <= 2) {
    cents = coefficient * (BigInt(10) ** BigInt(2 - scale));
  } else {
    const divisor = BigInt(10) ** BigInt(scale - 2);
    cents = coefficient / divisor;
    const remainder = coefficient % divisor;
    if (remainder * BigInt(2) >= divisor) cents += BigInt(1);
  }
  if (cents > NUMERIC_18_2_MAX_CENTS) {
    throw new Error('numeric(18,2) value is out of range.');
  }
  return negative ? -cents : cents;
}

function formatCents(cents: bigint): string {
  const negative = cents < BigInt(0);
  const absolute = negative ? -cents : cents;
  return `${negative ? '-' : ''}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
}

function formatNumeric18_2(value: Exclude<SqlitePrimitive, null>): string {
  return formatCents(decimalToNumeric18_2Cents(value));
}

function sourceDecimalToRoundedCents(value: Exclude<SqlitePrimitive, null>): bigint {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('numeric(18,2) requires a finite numeric value.');
  }
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(String(value).trim());
  if (!match) throw new Error('numeric(18,2) requires a valid decimal value.');

  const negative = match[1] === '-';
  const integerPart = match[2] ?? '0';
  const fractionPart = match[3] ?? match[4] ?? '';
  const exponentText = match[5] ?? '0';
  if (exponentText.length > 6) {
    throw new Error(exponentText.startsWith('-')
      ? 'numeric(18,2) source scale exceeds the supported limit.'
      : 'numeric(18,2) value is out of range.');
  }
  const exponent = Number.parseInt(exponentText, 10);
  let digits = `${integerPart}${fractionPart}`.replace(/^0+/, '') || '0';
  let scale = fractionPart.length - exponent;
  if (digits === '0') return BigInt(0);
  while (scale > 0 && digits.endsWith('0')) {
    digits = digits.slice(0, -1);
    scale -= 1;
  }
  if (scale > 18) {
    throw new Error('numeric(18,2) source scale exceeds the supported limit.');
  }

  let whole: string;
  let fraction: string;
  if (scale <= 0) {
    if (scale < -16) throw new Error('numeric(18,2) value is out of range.');
    whole = `${digits}${'0'.repeat(-scale)}`;
    fraction = '';
  } else if (digits.length > scale) {
    whole = digits.slice(0, -scale);
    fraction = digits.slice(-scale);
  } else {
    whole = '0';
    fraction = `${'0'.repeat(scale - digits.length)}${digits}`;
  }
  whole = whole.replace(/^0+(?=\d)/, '');
  if (whole.length > 16) throw new Error('numeric(18,2) value is out of range.');

  let cents = BigInt(whole) * BigInt(100)
    + BigInt(fraction.slice(0, 2).padEnd(2, '0') || '0');
  if ((fraction[2] ?? '0') >= '5') cents += BigInt(1);
  if (cents > NUMERIC_18_2_MAX_CENTS) {
    throw new Error('numeric(18,2) value is out of range.');
  }
  return negative ? -cents : cents;
}

function sumSourceMoney(rows: readonly SqliteRow[], column: string): string {
  const cents = rows.reduce((sum, row) => {
    const value = row[column];
    return value === null || value === undefined
      ? sum
      : sum + sourceDecimalToRoundedCents(value);
  }, BigInt(0));
  return formatCents(cents);
}

function comparePrimitive(left: SqlitePrimitive, right: SqlitePrimitive): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'bigint' && typeof right === 'bigint') return left < right ? -1 : left > right ? 1 : 0;
  return String(left).localeCompare(String(right));
}

const CRITICAL_FOREIGN_KEYS = [
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

function orphanSummary(rows: Record<string, SqliteRow[]>): Record<string, number> {
  return Object.fromEntries(CRITICAL_FOREIGN_KEYS.map(([child, childColumn, parent, parentColumn]) => {
    const parentValues = new Set((rows[parent] ?? []).map((row) => String(row[parentColumn])));
    const count = (rows[child] ?? []).filter((row) => {
      const value = row[childColumn];
      return value !== null && value !== undefined && !parentValues.has(String(value));
    }).length;
    return [`${child}.${childColumn}->${parent}.${parentColumn}`, count];
  }));
}

function buildSummary(
  rows: Record<string, SqliteRow[]>,
  ignoredSourceTables: string[],
  normalizations: Record<string, number> = {},
): MigrationSummary {
  const tables = Object.fromEntries(MIGRATION_TABLES.map((table) => {
    const tableRows = rows[table.name] ?? [];
    const values = tableRows
      .map((row) => row[table.primaryKey])
      .filter((value): value is Exclude<SqlitePrimitive, null> => value !== null && value !== undefined)
      .sort(comparePrimitive);
    const sensitive = table.name === 'auth_sessions';
    return [table.name, {
      count: tableRows.length,
      primaryKey: sensitive ? null : {
        min: values[0] === undefined ? null : String(values[0]),
        max: values.at(-1) === undefined ? null : String(values.at(-1)),
      },
    }];
  }));
  const quoteAggregate = (name: 'engineering_quotes' | 'maintenance_quotes'): QuoteAggregateSummary => ({
    count: rows[name]?.length ?? 0,
    subtotal: sumSourceMoney(rows[name] ?? [], 'subtotal'),
    tax: sumSourceMoney(rows[name] ?? [], 'tax'),
    total: sumSourceMoney(rows[name] ?? [], 'total'),
  });
  return {
    tables,
    aggregates: {
      engineering_quotes: quoteAggregate('engineering_quotes'),
      maintenance_quotes: quoteAggregate('maintenance_quotes'),
    },
    users: (rows.users ?? []).map((row) => ({
      id: String(row.id),
      username: String(row.username),
      role: String(row.role),
      isActive: Boolean(Number(row.is_active)),
      passwordHash: String(row.password_hash),
    })),
    authTokenHashes: (rows.auth_sessions ?? []).map((row) => String(row.token_hash)).sort(),
    orphans: orphanSummary(rows),
    normalizations,
    ignoredSourceTables,
  };
}

function readSnapshotFromDatabase(database: SqliteDatabase): MigrationSnapshot {
  const sourceTables = listSourceTables(database);
  const sourceTableSet = new Set(sourceTables);
  const ignoredSourceTables: string[] = [];
  for (const table of sourceTables) {
    if (table.startsWith('sqlite_')) continue;
    if (TABLE_BY_NAME.has(table)) continue;
    const count = scalarCount(database, table);
    if (table === OBSOLETE_TABLE && count > 0) {
      throw new Error('Obsolete ai_models contains rows and requires manual mapping.');
    }
    if (!SOURCE_METADATA_TABLES.has(table) && table !== OBSOLETE_TABLE && count > 0) {
      throw new Error(`Populated source table ${table} is not in the migration manifest.`);
    }
    ignoredSourceTables.push(table);
  }
  ignoredSourceTables.sort();

  const rows: Record<string, SqliteRow[]> = {};
  const sourceColumns: Record<string, string[]> = {};
  const normalizations: Record<string, number> = {};
  for (const table of MIGRATION_TABLES) {
    if (!sourceTableSet.has(table.name)) {
      rows[table.name] = [];
      sourceColumns[table.name] = [];
      continue;
    }
    const presentColumns = new Set(listColumns(database, table.name));
    const columns = table.columns.filter((column) => presentColumns.has(column));
    if (!columns.includes(table.primaryKey)) {
      throw new Error(`Source table ${table.name} is missing its primary key.`);
    }
    const selectColumns = columns.map(quoteIdentifier).join(', ');
    const orderExpression = LEGACY_ITEM_PRIMARY_KEY_TABLES.has(table.name)
      ? `COALESCE(${quoteIdentifier(table.primaryKey)}, ${quoteIdentifier('item_id')})`
      : quoteIdentifier(table.primaryKey);
    const rawRows = allRows(
      database,
      `SELECT ${selectColumns} FROM ${quoteIdentifier(table.name)} ORDER BY ${orderExpression}`,
    ).map(normalizeRow);
    if (LEGACY_ITEM_PRIMARY_KEY_TABLES.has(table.name)) {
      normalizations[table.name] = rawRows.filter((row) => row.id === null || row.id === '').length;
    }
    rows[table.name] = normalizeLegacyPrimaryKeys(table.name, rawRows);
    sourceColumns[table.name] = columns;
  }
  return {
    rows,
    sourceColumns,
    ignoredSourceTables,
    summary: buildSummary(rows, ignoredSourceTables, normalizations),
  };
}

export function assertSafeSourceTables(sourcePath: string): void {
  const database = openSqliteReadOnly(sourcePath);
  try {
    integrityCheck(database);
    readSnapshotFromDatabase(database);
  } finally {
    database.close();
  }
}

export function readSqliteSnapshot(sourcePath: string): MigrationSnapshot {
  let database: SqliteDatabase | undefined;
  try {
    database = openSqliteReadOnly(sourcePath);
    integrityCheck(database);
    return readSnapshotFromDatabase(database);
  } catch (error) {
    if (error instanceof Error && /manual mapping|not in the migration manifest|missing its primary key/i.test(error.message)) {
      throw error;
    }
    throw new Error('SQLite integrity check failed.');
  } finally {
    database?.close();
  }
}

function backupFilename(sourcePath: string, now: Date): string {
  const extension = path.extname(sourcePath) || '.db';
  const basename = path.basename(sourcePath, extension);
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `${basename}.migration-${timestamp}${extension}`;
}

export function prepareSqliteSource(
  sourcePath: string,
  options: PrepareSqliteOptions = {},
): PreparedSqliteSource {
  let source: SqliteDatabase | undefined;
  let backup: SqliteDatabase | undefined;
  try {
    source = openSqliteReadOnly(sourcePath);
    const sourceIntegrity = integrityCheck(source);
    const sourceSnapshot = readSnapshotFromDatabase(source);
    const backupDirectory = options.backupDirectory ?? path.join(path.dirname(sourcePath), 'backups');
    const backupPath = path.join(backupDirectory, backupFilename(sourcePath, options.now ?? new Date()));
    if (fs.existsSync(backupPath)) throw new Error('SQLite backup already exists.');
    fs.mkdirSync(backupDirectory, { recursive: true });
    source.prepare('VACUUM INTO ?').run(backupPath);
    backup = openSqliteReadOnly(backupPath);
    const backupIntegrity = integrityCheck(backup);
    const backupSnapshot = readSnapshotFromDatabase(backup);
    if (JSON.stringify(sourceSnapshot) !== JSON.stringify(backupSnapshot)) {
      throw new Error('SQLite backup verification failed.');
    }
    return {
      sourceIntegrity,
      backupIntegrity,
      backupPath,
      baseline: sourceSnapshot.summary,
    };
  } catch (error) {
    if (error instanceof Error && /backup already exists|manual mapping|not in the migration manifest|backup verification/i.test(error.message)) {
      throw error;
    }
    throw new Error('SQLite integrity check failed.');
  } finally {
    backup?.close();
    source?.close();
  }
}

export function transformSqliteValue(table: string, column: string, value: SqlitePrimitive): unknown {
  const key = `${table}.${column}`;
  if (BOOLEAN_COLUMNS.has(key)) {
    if (value === 0 || value === BigInt(0) || value === '0') return false;
    if (value === 1 || value === BigInt(1) || value === '1') return true;
    throw new Error(`Invalid boolean value for ${key}.`);
  }
  if (value === '' && NULLABLE_TEMPORAL_COLUMNS.has(key)) return null;
  if ((value === '' || value === null) && NON_NULL_TEMPORAL_COLUMNS.has(key)) {
    throw new Error(`Invalid empty non-null timestamp for ${key}.`);
  }
  if (TIMESTAMP_COLUMNS.has(key) && value !== null) {
    if (typeof value !== 'string') throw new Error(`Invalid timestamp value for ${key}.`);
    const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
      ? `${value.replace(' ', 'T')}Z`
      : value;
    if (Number.isNaN(Date.parse(normalized))) throw new Error(`Invalid timestamp value for ${key}.`);
    return normalized;
  }
  if (MONEY_COLUMNS.has(key) && value !== null) return formatNumeric18_2(value);
  if (JSON_COLUMNS.has(key) && value !== null) {
    if (typeof value !== 'string') throw new Error(`Invalid JSON value for ${key}.`);
    JSON.parse(value);
    return value;
  }
  return value;
}

function insertSql(table: MigrationTableSpec, columns: readonly string[]): string {
  const identifiers = columns.map(quoteIdentifier).join(', ');
  const parameters = columns.map((_, index) => `$${index + 1}`).join(', ');
  return `INSERT INTO ${quoteIdentifier(table.name)} (${identifiers}) VALUES (${parameters})`;
}

export async function importSqliteSnapshot(
  client: DatabaseClient,
  snapshot: MigrationSnapshot,
  options: {
    transformValue?: typeof transformSqliteValue;
    finalize?: (client: DatabaseClient, result: ImportResult) => Promise<void>;
  } = {},
): Promise<ImportResult> {
  const transformValue = options.transformValue ?? transformSqliteValue;
  if (options.finalize) {
    return client.transaction(async (transactionClient) => {
      const result = await importSqliteSnapshot(transactionClient, snapshot, { transformValue });
      await options.finalize?.(transactionClient, result);
      return result;
    });
  }
  const importedCounts = Object.fromEntries(MIGRATION_TABLES.map(({ name }) => [name, 0]));
  for (const group of MIGRATION_GROUPS) {
    await client.transaction(async (transactionClient) => {
      for (const tableName of group) {
        const table = TABLE_BY_NAME.get(tableName);
        if (!table) throw new Error('Migration manifest is inconsistent.');
        const columns = snapshot.sourceColumns[tableName] ?? [];
        if (columns.length === 0) continue;
        const sql = insertSql(table, columns);
        for (const row of snapshot.rows[tableName] ?? []) {
          const params = columns.map((column) => transformValue(tableName, column, row[column] ?? null));
          await transactionClient.query(sql, params);
          importedCounts[tableName] += 1;
        }
      }
    });
  }

  const identities: Record<string, { reset: boolean }> = {};
  for (const table of MIGRATION_TABLES.filter(({ identity }) => identity)) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE(max("id"), 1), max("id") IS NOT NULL) FROM ${quoteIdentifier(table.name)}`,
      [table.name, table.primaryKey],
    );
    identities[table.name] = { reset: true };
  }
  return { importedCounts, identities };
}

export async function assertTargetReadyForImport(
  client: DatabaseClient,
  options: {
    allowNonemptyTarget: boolean;
    hadMigrationMetadata: boolean;
  },
): Promise<void> {
  for (const table of MIGRATION_TABLES) {
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${quoteIdentifier(table.name)}`,
    );
    if (parseCount(result.rows[0]) > 0) {
      throw new Error('Target database contains business rows; destructive replacement is not supported.');
    }
  }
  if (options.hadMigrationMetadata && !options.allowNonemptyTarget) {
    throw new Error('Target database already contains schema metadata; pass --allow-nonempty-target only after confirming it has no business rows.');
  }
}

async function targetHasMigrationMetadata(client: DatabaseClient): Promise<boolean> {
  const relation = await client.query<{ relation_name: string | null }>(
    "SELECT to_regclass('schema_migrations')::text AS relation_name",
  );
  return Boolean(relation.rows[0]?.relation_name);
}

export async function assertTargetSchema(client: DatabaseClient): Promise<void> {
  const result = await client.query<{ table_name: string; column_name: string }>(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
    ORDER BY table_name, ordinal_position
  `);
  const actual = new Map<string, Set<string>>();
  for (const row of result.rows) {
    if (!TABLE_BY_NAME.has(row.table_name)) continue;
    const columns = actual.get(row.table_name) ?? new Set<string>();
    columns.add(row.column_name);
    actual.set(row.table_name, columns);
  }
  for (const table of MIGRATION_TABLES) {
    const columns = actual.get(table.name);
    if (!columns || columns.size !== table.columns.length
      || table.columns.some((column) => !columns.has(column))) {
      throw new Error(`Target PostgreSQL schema does not match the canonical manifest for ${table.name}.`);
    }
  }
}

async function targetMigrationVersions(client: DatabaseClient): Promise<number[]> {
  const result = await client.query<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  return result.rows.map(({ version }) => Number(version));
}

function fingerprintSnapshot(snapshot: MigrationSnapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function parseCompletedReport(value: unknown, fingerprint: string): DatabaseImportReport {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== 'object') throw new Error('Completed import ledger report is invalid.');
  const report = parsed as Partial<DatabaseImportReport>;
  if (report.success !== true || report.sourceFingerprint !== fingerprint
    || typeof report.importId !== 'string' || !report.importId) {
    throw new Error('Completed import ledger report is invalid.');
  }
  return report as DatabaseImportReport;
}

async function completedImportReport(
  client: DatabaseClient,
  fingerprint: string,
): Promise<DatabaseImportReport | null> {
  const result = await client.query<{ import_id: string; report_json: unknown }>(`
    SELECT import_id, report_json
    FROM sqlite_import_runs
    WHERE source_fingerprint = $1 AND status = 'complete'
  `, [fingerprint]);
  if (result.rows.length === 0) return null;
  const report = parseCompletedReport(result.rows[0].report_json, fingerprint);
  if (report.importId !== result.rows[0].import_id) {
    throw new Error('Completed import ledger report is invalid.');
  }
  return report;
}

function serializeSafeReport(report: unknown): string {
  const serialized = JSON.stringify(report, null, 2);
  if (/postgres(?:ql)?:\/\//i.test(serialized) || /\$2[aby]\$/i.test(serialized)
    || /sha256:/i.test(serialized)) {
    throw new Error('Refusing to persist a report containing secrets.');
  }
  return serialized;
}

export async function migrateSqliteDatabase(
  options: MigrateSqliteDatabaseOptions,
): Promise<DatabaseImportReport> {
  const startTime = (options.now ?? new Date()).toISOString();
  const sourceSnapshot = readSqliteSnapshot(options.sourcePath);
  const sourceFingerprint = fingerprintSnapshot(sourceSnapshot);
  const importId = `sqlite-${sourceFingerprint.slice(0, 32)}`;
  const verifyMigration = options.verifyMigration ?? verifyDatabaseMigration;
  return options.client.transaction(async (transactionClient) => {
    await transactionClient.query(
      `SELECT pg_advisory_xact_lock(${SQLITE_IMPORT_ADVISORY_LOCK_ID})`,
    );
    const lockedSourceSnapshot = readSqliteSnapshot(options.sourcePath);
    if (fingerprintSnapshot(lockedSourceSnapshot) !== sourceFingerprint) {
      throw new Error('SQLite source changed while waiting for the import lock.');
    }
    const hadMigrationMetadata = await targetHasMigrationMetadata(transactionClient);
    await (options.runMigrations ?? runPostgresMigrations)(transactionClient);
    await (options.validateTargetSchema ?? assertTargetSchema)(transactionClient);

    const completed = await completedImportReport(transactionClient, sourceFingerprint);
    if (completed) {
      const verification = await verifyMigration({
        sourcePath: options.sourcePath,
        client: transactionClient,
      });
      if (!verification.success) throw new MigrationVerificationError(verification);
      return completed;
    }

    await assertTargetReadyForImport(transactionClient, {
      allowNonemptyTarget: options.allowNonemptyTarget ?? false,
      hadMigrationMetadata,
    });
    const prepared = prepareSqliteSource(options.sourcePath, {
      backupDirectory: options.backupDirectory,
      now: options.now,
    });
    const snapshot = readSqliteSnapshot(prepared.backupPath);
    if (fingerprintSnapshot(snapshot) !== sourceFingerprint) {
      throw new Error('SQLite backup fingerprint does not match the checked source.');
    }
    const migrationVersions = await targetMigrationVersions(transactionClient);
    const imported = await importSqliteSnapshot(transactionClient, snapshot);
    const verification = await verifyMigration({
      sourcePath: options.sourcePath,
      client: transactionClient,
    });
    if (!verification.success) throw new MigrationVerificationError(verification);
    const endTime = new Date().toISOString();
    const report: DatabaseImportReport = {
      success: true,
      importId,
      sourceFingerprint,
      backupPath: prepared.backupPath,
      sourceIntegrity: prepared.sourceIntegrity,
      backupIntegrity: prepared.backupIntegrity,
      targetMigrationVersions: migrationVersions,
      baseline: {
        tables: prepared.baseline.tables,
        aggregates: prepared.baseline.aggregates,
        normalizations: prepared.baseline.normalizations,
        ignoredSourceTables: prepared.baseline.ignoredSourceTables,
      },
      importedCounts: imported.importedCounts,
      verification,
      startTime,
      endTime,
    };
    const serializedReport = serializeSafeReport(report);
    await transactionClient.query(`
      INSERT INTO sqlite_import_runs
        (import_id, source_fingerprint, status, source_integrity, backup_integrity,
         backup_path, target_migration_versions, imported_counts, report_json,
         started_at, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      importId,
      sourceFingerprint,
      'complete',
      prepared.sourceIntegrity,
      prepared.backupIntegrity,
      prepared.backupPath,
      JSON.stringify(migrationVersions),
      JSON.stringify(imported.importedCounts),
      serializedReport,
      startTime,
      endTime,
    ]);
    return report;
  });
}

function rangesEqual(left: PrimaryKeyRange | null, right: PrimaryKeyRange | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildMigrationVerification(
  source: MigrationSummary,
  target: MigrationSummary,
  identities: Record<string, IdentityVerification>,
): MigrationVerificationReport {
  const tables = Object.fromEntries(MIGRATION_TABLES.map(({ name }) => {
    const sourceTable = source.tables[name] ?? { count: 0, primaryKey: null };
    const targetTable = target.tables[name] ?? { count: 0, primaryKey: null };
    return [name, {
      sourceCount: sourceTable.count,
      targetCount: targetTable.count,
      countMatches: sourceTable.count === targetTable.count,
      sourcePrimaryKey: sourceTable.primaryKey,
      targetPrimaryKey: targetTable.primaryKey,
      primaryKeyMatches: rangesEqual(sourceTable.primaryKey, targetTable.primaryKey),
    }];
  }));
  const targetUsers = new Map(target.users.map((user) => [user.id, user]));
  const users = source.users.map((user) => {
    const targetUser = targetUsers.get(user.id);
    return {
      id: user.id,
      username: user.username,
      usernameMatches: user.username === targetUser?.username,
      roleMatches: user.role === targetUser?.role,
      activeMatches: user.isActive === targetUser?.isActive,
      passwordHashMatches: targetUser?.passwordHashMatches
        ?? (user.passwordHash !== undefined && user.passwordHash === targetUser?.passwordHash),
    };
  });
  const aggregates = Object.fromEntries(
    (['engineering_quotes', 'maintenance_quotes'] as const).map((name) => [name, {
      source: source.aggregates[name],
      target: target.aggregates[name],
      matches: JSON.stringify(source.aggregates[name]) === JSON.stringify(target.aggregates[name]),
    }]),
  );
  const orphanNames = new Set([...Object.keys(source.orphans), ...Object.keys(target.orphans)]);
  const orphans = Object.fromEntries([...orphanNames].sort().map((name) => {
    const sourceCount = source.orphans[name] ?? 0;
    const targetCount = target.orphans[name] ?? 0;
    return [name, { source: sourceCount, target: targetCount, matches: sourceCount === targetCount }];
  }));
  const authSessionTokenHashesMatch = JSON.stringify(source.authTokenHashes ?? [])
    === JSON.stringify(target.authTokenHashes ?? []);
  const success = Object.values(tables).every(({ countMatches, primaryKeyMatches }) => countMatches && primaryKeyMatches)
    && Object.values(aggregates).every(({ matches }) => matches)
    && users.every(({ usernameMatches, roleMatches, activeMatches, passwordHashMatches }) => usernameMatches && roleMatches && activeMatches && passwordHashMatches)
    && authSessionTokenHashesMatch
    && Object.values(orphans).every(({ matches }) => matches)
    && Object.values(identities).every(({ safe }) => safe);
  return {
    success,
    tables,
    aggregates,
    users,
    authSessionTokenHashesMatch,
    orphans,
    identities,
    ignoredSourceTables: source.ignoredSourceTables,
  };
}

function parseCount(row: Record<string, unknown> | undefined): number {
  return Number(row?.count ?? 0);
}

function normalizeTargetMoney(value: unknown): string {
  if (value === null || value === undefined) return '0.00';
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(value).trim());
  if (!match) throw new Error('Target PostgreSQL returned an invalid numeric aggregate.');
  const fraction = match[3] ?? '';
  if (fraction.length > 2 && /[^0]/.test(fraction.slice(2))) {
    throw new Error('Target PostgreSQL returned an over-scale numeric aggregate.');
  }
  const sign = match[1] === '-' && !/^0+$/.test(`${match[2]}${fraction}`) ? '-' : '';
  const whole = match[2].replace(/^0+(?=\d)/, '');
  return `${sign}${whole}.${fraction.slice(0, 2).padEnd(2, '0')}`;
}

async function collectTargetSummary(client: DatabaseClient): Promise<MigrationSummary> {
  const tables: Record<string, TableSummary> = {};
  for (const table of MIGRATION_TABLES) {
    const countResult = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${quoteIdentifier(table.name)}`,
    );
    let primaryKey: PrimaryKeyRange | null = null;
    if (table.name !== 'auth_sessions') {
      const range = await client.query<{ min: string | null; max: string | null }>(
        `SELECT min(${quoteIdentifier(table.primaryKey)})::text AS min, max(${quoteIdentifier(table.primaryKey)})::text AS max FROM ${quoteIdentifier(table.name)}`,
      );
      primaryKey = { min: range.rows[0]?.min ?? null, max: range.rows[0]?.max ?? null };
    }
    tables[table.name] = { count: parseCount(countResult.rows[0]), primaryKey };
  }
  const aggregateRows = async (table: 'engineering_quotes' | 'maintenance_quotes'): Promise<QuoteAggregateSummary> => {
    const result = await client.query<{ count: string; subtotal: string; tax: string; total: string }>(
      `SELECT count(*)::text AS count, COALESCE(sum("subtotal"), 0)::text AS subtotal, COALESCE(sum("tax"), 0)::text AS tax, COALESCE(sum("total"), 0)::text AS total FROM ${quoteIdentifier(table)}`,
    );
    return {
      count: parseCount(result.rows[0]),
      subtotal: normalizeTargetMoney(result.rows[0]?.subtotal),
      tax: normalizeTargetMoney(result.rows[0]?.tax),
      total: normalizeTargetMoney(result.rows[0]?.total),
    };
  };
  const usersResult = await client.query<{
    id: string;
    username: string;
    role: string;
    is_active: boolean;
    password_hash: string;
  }>('SELECT id::text, username, role, is_active, password_hash FROM "users" ORDER BY id');
  const tokenResult = await client.query<{ token_hash: string }>(
    'SELECT token_hash FROM "auth_sessions" ORDER BY token_hash',
  );
  const orphans: Record<string, number> = {};
  for (const [child, childColumn, parent, parentColumn] of CRITICAL_FOREIGN_KEYS) {
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${quoteIdentifier(child)} child LEFT JOIN ${quoteIdentifier(parent)} parent ON child.${quoteIdentifier(childColumn)} = parent.${quoteIdentifier(parentColumn)} WHERE child.${quoteIdentifier(childColumn)} IS NOT NULL AND parent.${quoteIdentifier(parentColumn)} IS NULL`,
    );
    orphans[`${child}.${childColumn}->${parent}.${parentColumn}`] = parseCount(result.rows[0]);
  }
  return {
    tables,
    aggregates: {
      engineering_quotes: await aggregateRows('engineering_quotes'),
      maintenance_quotes: await aggregateRows('maintenance_quotes'),
    },
    users: usersResult.rows.map((row) => ({
      id: String(row.id),
      username: String(row.username),
      role: String(row.role),
      isActive: Boolean(row.is_active),
      passwordHash: String(row.password_hash),
    })),
    authTokenHashes: tokenResult.rows.map(({ token_hash }) => String(token_hash)),
    orphans,
    normalizations: {},
    ignoredSourceTables: [],
  };
}

async function collectIdentitySummary(client: DatabaseClient): Promise<Record<string, IdentityVerification>> {
  const identities: Record<string, IdentityVerification> = {};
  for (const table of MIGRATION_TABLES.filter(({ identity }) => identity)) {
    const result = await client.query<{ sequence_value: string | null; max_id: string | null }>(`
      SELECT sequence_state.last_value::text AS sequence_value,
             table_state.max_id::text AS max_id
      FROM (SELECT max("id") AS max_id FROM ${quoteIdentifier(table.name)}) table_state
      LEFT JOIN pg_sequences sequence_state
        ON sequence_state.schemaname = current_schema()
       AND quote_ident(sequence_state.schemaname) || '.' || quote_ident(sequence_state.sequencename)
           = pg_get_serial_sequence($1, $2)
    `, [table.name, table.primaryKey]);
    const sequenceValue = result.rows[0]?.sequence_value ?? null;
    const maxId = result.rows[0]?.max_id ?? null;
    identities[table.name] = {
      sequenceValue,
      maxId,
      safe: maxId === null || (sequenceValue !== null && BigInt(sequenceValue) >= BigInt(maxId)),
    };
  }
  return identities;
}

export async function verifyDatabaseMigration(options: {
  sourcePath: string;
  client: DatabaseClient;
}): Promise<MigrationVerificationReport> {
  const source = readSqliteSnapshot(options.sourcePath).summary;
  const target = await collectTargetSummary(options.client);
  const identities = await collectIdentitySummary(options.client);
  const report = buildMigrationVerification(source, target, identities);
  if (!report.success) throw new MigrationVerificationError(report);
  return report;
}

export function writeJsonReportAtomic(reportPath: string, report: unknown): void {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(reportPath),
    `.${path.basename(reportPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  const serialized = `${serializeSafeReport(report)}\n`;
  try {
    fs.writeFileSync(temporaryPath, serialized, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporaryPath, reportPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function preflightJsonReport(reportPath: string): void {
  const directory = path.dirname(reportPath);
  fs.mkdirSync(directory, { recursive: true });
  if (fs.existsSync(reportPath) && fs.statSync(reportPath).isDirectory()) {
    throw new Error('Migration report destination is a directory.');
  }
  const probePath = path.join(directory, `.${path.basename(reportPath)}.${randomUUID()}.probe`);
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(probePath, 'wx', 0o600);
    fs.writeFileSync(descriptor, '{}\n');
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(probePath, { force: true });
  }
}
