import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

import { assertDistinctProtectedPaths } from './safe-report';
import {
  CRITICAL_FOREIGN_KEYS,
  LEGACY_IGNORED_SOURCE_COLUMNS,
  LEGACY_ITEM_PRIMARY_KEY_TABLES,
  MIGRATION_TABLES,
  OBSOLETE_TABLE,
  POLYMORPHIC_QUOTE_TABLES,
  SOURCE_METADATA_TABLES,
  TABLE_BY_NAME,
  polymorphicOrphanKey,
  type MigrationTableSpec,
} from './manifest';
import type {
  MigrationSnapshot,
  MigrationSummary,
  PreparedSqliteSource,
  PrepareSqliteOptions,
  QuoteAggregateSummary,
  SqlitePrimitive,
  SqliteRow,
} from './types';

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

function formatCents(cents: bigint): string {
  const negative = cents < BigInt(0);
  const absolute = negative ? -cents : cents;
  return `${negative ? '-' : ''}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
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

function comparePrimaryKey(
  table: MigrationTableSpec,
  left: Exclude<SqlitePrimitive, null>,
  right: Exclude<SqlitePrimitive, null>,
): number {
  if (!table.identity) return String(left).localeCompare(String(right));
  const leftId = BigInt(String(left));
  const rightId = BigInt(String(right));
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}


function orphanSummary(rows: Record<string, SqliteRow[]>): Record<string, number> {
  const direct = CRITICAL_FOREIGN_KEYS.map(([child, childColumn, parent, parentColumn]) => {
    const parentValues = new Set((rows[parent] ?? []).map((row) => String(row[parentColumn])));
    const count = (rows[child] ?? []).filter((row) => {
      const value = row[childColumn];
      return value !== null && value !== undefined && !parentValues.has(String(value));
    }).length;
    return [`${child}.${childColumn}->${parent}.${parentColumn}`, count];
  });
  const engineeringIds = new Set((rows.engineering_quotes ?? []).map((row) => String(row.id)));
  const maintenanceIds = new Set((rows.maintenance_quotes ?? []).map((row) => String(row.id)));
  const polymorphic = POLYMORPHIC_QUOTE_TABLES.map((table) => [
    polymorphicOrphanKey(table),
    (rows[table] ?? []).filter((row) => {
      if (row.quote_id === null || row.quote_id === undefined) return false;
      const quoteId = String(row.quote_id);
      if (row.quote_type === 'engineering') return !engineeringIds.has(quoteId);
      if (row.quote_type === 'maintenance') return !maintenanceIds.has(quoteId);
      return true;
    }).length,
  ] as const);
  return Object.fromEntries([...direct, ...polymorphic]);
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
      .sort((left, right) => comparePrimaryKey(table, left, right));
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
    const ignoredColumns = LEGACY_IGNORED_SOURCE_COLUMNS[table.name] ?? new Set<string>();
    const unexpectedColumns = [...presentColumns]
      .filter((column) => !table.columns.includes(column) && !ignoredColumns.has(column))
      .sort();
    if (unexpectedColumns.length > 0) {
      throw new Error(`Unexpected source column in ${table.name}: ${unexpectedColumns.join(', ')}.`);
    }
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
    if (error instanceof Error && /manual mapping|not in the migration manifest|missing its primary key|unexpected source column/i.test(error.message)) {
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
    assertDistinctProtectedPaths(backupPath, [sourcePath, ...(options.protectedPaths ?? [])]);
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
    if (error instanceof Error && /backup already exists|manual mapping|not in the migration manifest|backup verification|protected data file|overlap/i.test(error.message)) {
      throw error;
    }
    throw new Error('SQLite integrity check failed.');
  } finally {
    backup?.close();
    source?.close();
  }
}
