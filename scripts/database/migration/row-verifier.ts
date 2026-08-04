import { createHash } from 'node:crypto';

import { canonicalizeSourceJson, canonicalizeSourceMoney } from './source-canonicalizer';
import { canonicalizeTargetJson, canonicalizeTargetMoney } from './target-canonicalizer';

export type CanonicalRowValue = bigint | number | string | boolean | null;
export type CanonicalRow = Record<string, CanonicalRowValue>;

export interface RowVerificationTableSpec {
  name: string;
  columns: readonly string[];
  primaryKey: string;
}

export interface RowVerificationInput {
  tables: readonly RowVerificationTableSpec[];
  sourceRows: Readonly<Record<string, readonly CanonicalRow[]>>;
  sourceColumns: Readonly<Record<string, readonly string[]>>;
  targetRows: Readonly<Record<string, readonly CanonicalRow[]>>;
  booleanColumns: ReadonlySet<string>;
  moneyColumns: ReadonlySet<string>;
  jsonColumns: ReadonlySet<string>;
  nullableTemporalColumns: ReadonlySet<string>;
  timestampColumns: ReadonlySet<string>;
}

export interface ColumnNullVerification {
  sourceNullCount: number;
  targetNullCount: number;
  matches: boolean;
}

export interface MoneyColumnVerification extends ColumnNullVerification {
  valuesMatch: boolean;
}

export interface TableRowVerification {
  sourceCount: number;
  targetCount: number;
  matchedCount: number;
  mismatchedCount: number;
  missingCount: number;
  unexpectedCount: number;
  rowsMatch: boolean;
  mismatchIdentifiers: string[];
  columns: Record<string, ColumnNullVerification>;
  moneyColumns: Record<string, MoneyColumnVerification>;
}

export interface RowVerificationReport {
  success: boolean;
  tables: Record<string, TableRowVerification>;
}

function canonicalSourceValue(
  qualifiedColumn: string,
  value: CanonicalRowValue | undefined,
  input: RowVerificationInput,
): string {
  if (value === null || value === undefined) return 'null';
  if (value === '' && input.nullableTemporalColumns.has(qualifiedColumn)) return 'null';
  if (qualifiedColumn === 'intelligent_project_quotas.serial_number' && typeof value === 'string') {
    const legacySerial = /^IP-(\d+)$/i.exec(value.trim());
    if (legacySerial) return `scalar:${Number.parseInt(legacySerial[1], 10)}`;
  }
  if (input.moneyColumns.has(qualifiedColumn)) return `money:${canonicalizeSourceMoney(value)}`;
  if (input.booleanColumns.has(qualifiedColumn)) return `boolean:${Number(value) === 0 ? 'false' : 'true'}`;
  if (input.timestampColumns.has(qualifiedColumn)) {
    if (value === '') return 'null';
    const text = String(value);
    const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
      ? `${text.replace(' ', 'T')}Z`
      : text;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) throw new Error('SQLite source contains an invalid timestamp.');
    return `timestamp:${date.toISOString()}`;
  }
  if (input.jsonColumns.has(qualifiedColumn)) return `json:${canonicalizeSourceJson(String(value))}`;
  return `scalar:${String(value)}`;
}

function canonicalTargetValue(
  qualifiedColumn: string,
  value: CanonicalRowValue | undefined,
  input: RowVerificationInput,
): string {
  if (value === null || value === undefined) return 'null';
  if (input.moneyColumns.has(qualifiedColumn)) return `money:${canonicalizeTargetMoney(value)}`;
  if (input.booleanColumns.has(qualifiedColumn)) {
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === 't' || normalized === '1') return 'boolean:true';
    if (normalized === 'false' || normalized === 'f' || normalized === '0') return 'boolean:false';
    throw new Error('PostgreSQL returned an invalid boolean value.');
  }
  if (input.timestampColumns.has(qualifiedColumn)) {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new Error('PostgreSQL returned an invalid timestamp.');
    return `timestamp:${date.toISOString()}`;
  }
  if (input.jsonColumns.has(qualifiedColumn)) return `json:${canonicalizeTargetJson(String(value))}`;
  return `scalar:${String(value)}`;
}

function digest(parts: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function safeIdentifier(table: string, primaryKey: string): string {
  return digest([table, primaryKey]).slice(0, 24);
}

export function buildRowVerification(input: RowVerificationInput): RowVerificationReport {
  const tables = Object.fromEntries(input.tables.map((table) => {
    const columns = input.sourceColumns[table.name] ?? [];
    const sourceRows = input.sourceRows[table.name] ?? [];
    const targetRows = input.targetRows[table.name] ?? [];
    const sourceDigests = new Map<string, string>();
    const targetDigests = new Map<string, string>();
    const sourceMoney = new Map<string, Map<string, string>>();
    const targetMoney = new Map<string, Map<string, string>>();

    const addRows = (
      rows: readonly CanonicalRow[],
      destination: Map<string, string>,
      moneyDestination: Map<string, Map<string, string>>,
      canonicalize: typeof canonicalSourceValue,
    ): void => {
      for (const row of rows) {
        const primaryKey = String(row[table.primaryKey]);
        const values = columns.map((column) => canonicalize(`${table.name}.${column}`, row[column], input));
        destination.set(primaryKey, digest(columns.flatMap((column, index) => [column, values[index]])));
        for (const column of columns.filter((name) => input.moneyColumns.has(`${table.name}.${name}`))) {
          const byPrimaryKey = moneyDestination.get(column) ?? new Map<string, string>();
          byPrimaryKey.set(primaryKey, canonicalize(`${table.name}.${column}`, row[column], input));
          moneyDestination.set(column, byPrimaryKey);
        }
      }
    };

    addRows(sourceRows, sourceDigests, sourceMoney, canonicalSourceValue);
    addRows(targetRows, targetDigests, targetMoney, canonicalTargetValue);
    const primaryKeys = [...new Set([...sourceDigests.keys(), ...targetDigests.keys()])].sort();
    const mismatched = primaryKeys.filter((key) => sourceDigests.has(key)
      && targetDigests.has(key)
      && sourceDigests.get(key) !== targetDigests.get(key));
    const missing = primaryKeys.filter((key) => sourceDigests.has(key) && !targetDigests.has(key));
    const unexpected = primaryKeys.filter((key) => !sourceDigests.has(key) && targetDigests.has(key));
    const matchedCount = primaryKeys.filter((key) => sourceDigests.get(key) === targetDigests.get(key)
      && sourceDigests.has(key)
      && targetDigests.has(key)).length;

    const columnReports = Object.fromEntries(columns.map((column) => {
      const qualifiedColumn = `${table.name}.${column}`;
      const sourceNullCount = sourceRows.filter((row) => row[column] === null
        || row[column] === undefined
        || (row[column] === '' && input.nullableTemporalColumns.has(qualifiedColumn))).length;
      const targetNullCount = targetRows.filter((row) => row[column] === null || row[column] === undefined).length;
      return [column, {
        sourceNullCount,
        targetNullCount,
        matches: sourceNullCount === targetNullCount,
      }];
    }));
    const moneyReports = Object.fromEntries(columns
      .filter((column) => input.moneyColumns.has(`${table.name}.${column}`))
      .map((column) => {
        const sourceNullCount = columnReports[column].sourceNullCount;
        const targetNullCount = columnReports[column].targetNullCount;
        const sourceValues = sourceMoney.get(column) ?? new Map<string, string>();
        const targetValues = targetMoney.get(column) ?? new Map<string, string>();
        const valuesMatch = [...new Set([...sourceValues.keys(), ...targetValues.keys()])]
          .every((key) => sourceValues.has(key)
            && targetValues.has(key)
            && sourceValues.get(key) === targetValues.get(key));
        return [column, {
          sourceNullCount,
          targetNullCount,
          matches: sourceNullCount === targetNullCount,
          valuesMatch,
        }];
      }));
    const rowsMatch = mismatched.length === 0 && missing.length === 0 && unexpected.length === 0;
    return [table.name, {
      sourceCount: sourceRows.length,
      targetCount: targetRows.length,
      matchedCount,
      mismatchedCount: mismatched.length,
      missingCount: missing.length,
      unexpectedCount: unexpected.length,
      rowsMatch,
      mismatchIdentifiers: [...mismatched, ...missing, ...unexpected].sort()
        .map((key) => safeIdentifier(table.name, key)),
      columns: columnReports,
      moneyColumns: moneyReports,
    } satisfies TableRowVerification];
  }));
  return {
    success: Object.values(tables).every((table) => table.rowsMatch
      && Object.values(table.columns).every((column) => column.matches)
      && Object.values(table.moneyColumns).every((column) => column.matches && column.valuesMatch)),
    tables,
  };
}
