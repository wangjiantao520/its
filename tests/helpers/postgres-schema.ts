import fs from 'node:fs';
import path from 'node:path';

import { TABLE_COLUMNS } from '../../scripts/database/migration/manifest';

export type ColumnManifest = Map<string, Set<string>>;
export type PostgresColumnDefinitions = Map<string, Map<string, string>>;

const ROUTE_SOURCE_DIRECTORIES = ['src/app/api', 'src/lib'] as const;
const ROUTE_ONLY_TABLE_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  ai_model_logs: ['id', 'created_at'],
};
const DYNAMIC_ROUTE_WRITE_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  users: ['name', 'password_hash', 'is_active'],
  ai_model_configs: [
    'name', 'provider', 'model_name', 'api_endpoint', 'api_key', 'temperature',
    'max_tokens', 'system_prompt', 'description', 'is_default', 'sort_order',
  ],
  engineering_quotes: [
    'project_name', 'client_name', 'contact_person', 'contact_phone', 'subtotal',
    'tax', 'total', 'status', 'construction_area', 'management_rate', 'profit_rate',
    'regulatory_rate', 'tax_rate', 'management_fee', 'profit', 'regulatory_fee',
    'version', 'updated_at', 'items',
  ],
  maintenance_quotes: [
    'project_name', 'client_name', 'contact_person', 'contact_phone', 'subtotal',
    'tax', 'total', 'status', 'region', 'service_years', 'engineer_level', 'sla_config',
    'subtotal_before_discount', 'sla_adjustment', 'region_adjustment',
    'subtotal_after_coefficients', 'years_discount', 'bulk_discount',
    'years_discount_amount', 'bulk_discount_amount', 'version', 'updated_at', 'devices',
  ],
  quotation_records: ['project_name', 'client_name', 'total_amount', 'status', 'updated_at'],
};
const NON_TABLE_SQL_NAMES = new Set(['extras', 'ranked', 'set', 'sqlite_master']);

function listTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (filePath === path.join('src', 'lib', 'database')) continue;
      files.push(...listTypeScriptFiles(filePath));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(filePath);
    }
  }
  return files;
}

function addColumn(manifest: ColumnManifest, table: string, column: string): void {
  const columns = manifest.get(table) ?? new Set<string>();
  columns.add(column);
  manifest.set(table, columns);
}

function mergeManifest(target: ColumnManifest, source: ColumnManifest): void {
  for (const [table, columns] of source) {
    for (const column of columns) addColumn(target, table, column);
  }
}

export interface RouteSqlAudit {
  referencedTables: Set<string>;
  writeColumns: ColumnManifest;
}

export function extractRouteSqlAudit(): RouteSqlAudit {
  const referencedTables = new Set<string>(Object.keys(DYNAMIC_ROUTE_WRITE_COLUMNS));
  const writeColumns: ColumnManifest = new Map();
  const files = ROUTE_SOURCE_DIRECTORIES.flatMap((directory) => listTypeScriptFiles(directory));

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM)\s+([a-zA-Z_]\w*)/gi)) {
      const table = match[1].toLowerCase();
      if (!NON_TABLE_SQL_NAMES.has(table)) referencedTables.add(table);
    }
    for (const match of source.matchAll(/INSERT\s+INTO\s+(\w+)\s*\(([\s\S]*?)\)\s*VALUES/gi)) {
      for (const column of match[2].split(',').map((value) => value.trim())) {
        if (/^\w+$/.test(column)) addColumn(writeColumns, match[1], column);
      }
    }
    for (const match of source.matchAll(/UPDATE\s+(\w+)\s+SET\s+([\s\S]*?)\s+WHERE\b/gi)) {
      for (const assignment of match[2].split(',')) {
        const column = /^\s*(\w+)\s*=/.exec(assignment)?.[1];
        if (column) addColumn(writeColumns, match[1], column);
      }
    }
  }

  for (const [table, columns] of Object.entries(DYNAMIC_ROUTE_WRITE_COLUMNS)) {
    for (const column of columns) addColumn(writeColumns, table, column);
  }

  return { referencedTables, writeColumns };
}

export function buildCanonicalPostgresManifest(): ColumnManifest {
  const manifest: ColumnManifest = new Map(
    Object.entries(TABLE_COLUMNS).map(([table, columns]) => [table, new Set(columns)]),
  );

  const routeAudit = extractRouteSqlAudit();
  mergeManifest(manifest, routeAudit.writeColumns);
  for (const [table, columns] of Object.entries(ROUTE_ONLY_TABLE_COLUMNS)) {
    for (const column of columns) addColumn(manifest, table, column);
  }
  return manifest;
}

export function parsePostgresColumnDefinitions(sql: string): PostgresColumnDefinitions {
  const definitions: PostgresColumnDefinitions = new Map();
  const tablePattern = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\);/g;
  for (const match of sql.matchAll(tablePattern)) {
    const columns = new Map<string, string>();
    for (const line of match[2].split('\n')) {
      const column = /^\s{2}(\w+)\s+(.+?)(?:,)?$/.exec(line);
      if (column) columns.set(column[1], column[2].replace(/,$/, '').replace(/\s+/g, ' ').trim());
    }
    definitions.set(match[1], columns);
  }
  // 识别 ALTER TABLE ... ADD COLUMN（增量迁移新增的列），按行解析
  const alterTablePattern = /ALTER TABLE\s+(\w+)/g;
  const alterTableMatches = [...sql.matchAll(alterTablePattern)];
  for (const tableMatch of alterTableMatches) {
    const table = tableMatch[1];
    // 从 ALTER TABLE 语句起点到下一个分号
    const stmtEnd = sql.indexOf(';', tableMatch.index);
    const stmt = stmtEnd === -1 ? sql.slice(tableMatch.index) : sql.slice(tableMatch.index, stmtEnd);
    const addColumnPattern = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+([a-zA-Z0-9_.()'"\s]+?)(?:,|$)/gi;
    for (const addMatch of stmt.matchAll(addColumnPattern)) {
      const column = addMatch[1];
      const definition = addMatch[2].replace(/\s+/g, ' ').trim();
      if (!definitions.has(table)) definitions.set(table, new Map());
      definitions.get(table)?.set(column, definition);
    }
  }
  return definitions;
}

export function definitionsToManifest(definitions: PostgresColumnDefinitions): ColumnManifest {
  return new Map(
    [...definitions].map(([table, columns]) => [table, new Set(columns.keys())]),
  );
}

export function serializableManifest(manifest: ColumnManifest): Record<string, string[]> {
  return Object.fromEntries(
    [...manifest]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([table, columns]) => [table, [...columns].sort()]),
  );
}
