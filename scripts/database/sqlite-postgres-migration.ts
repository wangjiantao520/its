import { createHash } from 'node:crypto';

import type { DatabaseClient } from '../../src/lib/database/client';
import {
  runPostgresMigrations,
  type PostgresMigrationResult,
} from '../../src/lib/database/postgres-migrations';
import {
  assertDistinctProtectedPaths,
  serializeSafeReport,
  type ProtectedPathOptions,
} from './migration/safe-report';
import {
  BOOLEAN_COLUMNS,
  CRITICAL_FOREIGN_KEYS,
  JSON_COLUMNS,
  LEGACY_IGNORED_SOURCE_COLUMNS,
  LEGACY_ITEM_PRIMARY_KEY_TABLES,
  MIGRATION_GROUPS,
  MIGRATION_TABLES,
  MONEY_COLUMNS,
  NULLABLE_TEMPORAL_COLUMNS,
  OBSOLETE_TABLE,
  POLYMORPHIC_QUOTE_TABLES,
  SOURCE_METADATA_TABLES,
  SQLITE_IMPORT_ADVISORY_LOCK_ID,
  TABLE_BY_NAME,
  TIMESTAMP_COLUMNS,
  polymorphicOrphanKey,
  quoteIdentifier,
  type MigrationTableSpec,
} from './migration/manifest';
import {
  buildRowVerification,
  type CanonicalRow,
  type RowVerificationReport,
} from './migration/row-verifier';
import {
  assertSafeSourceTables,
  prepareSqliteSource,
  readSqliteSnapshot,
} from './migration/sqlite-source';
import {
  assertTargetSchemaContract,
  loadCanonicalTargetSchemaContract,
  type TargetColumnMetadata,
  type TargetConstraintMetadata,
  type TargetIndexMetadata,
} from './migration/target-schema';
import {
  MigrationVerificationError,
  type DatabaseImportReport,
  type IdentityVerification,
  type ImportResult,
  type MigrationSnapshot,
  type MigrationSummary,
  type MigrationVerificationReport,
  type PreparedSqliteSource,
  type PrepareSqliteOptions,
  type PrimaryKeyRange,
  type QuoteAggregateSummary,
  type SqlitePrimitive,
  type SqliteRow,
  type TableSummary,
} from './migration/types';
import { transformSqliteValue } from './migration/value-transform';

export {
  assertDistinctProtectedPaths,
  discoverProtectedDataPaths,
  preflightJsonReport,
  writeJsonReportAtomic,
  type ProtectedPathOptions,
} from './migration/safe-report';
export {
  MIGRATION_GROUPS,
  MIGRATION_TABLES,
  SQLITE_IMPORT_ADVISORY_LOCK_ID,
  type MigrationTableSpec,
} from './migration/manifest';
export {
  buildRowVerification,
  type CanonicalRow,
  type RowVerificationInput,
  type RowVerificationReport,
} from './migration/row-verifier';
export {
  assertSafeSourceTables,
  prepareSqliteSource,
  readSqliteSnapshot,
} from './migration/sqlite-source';
export {
  assertTargetSchemaContract,
  loadCanonicalTargetSchemaContract,
  parseTargetSchemaContract,
  type TargetColumnMetadata,
  type TargetConstraintMetadata,
  type TargetIndexMetadata,
  type TargetSchemaContract,
} from './migration/target-schema';
export {
  MigrationVerificationError,
  type DatabaseImportReport,
  type IdentityVerification,
  type ImportResult,
  type MigrationSnapshot,
  type MigrationSummary,
  type MigrationVerificationReport,
  type PreparedSqliteSource,
  type PrepareSqliteOptions,
  type PrimaryKeyRange,
  type QuoteAggregateSummary,
  type TableSummary,
  type VerificationUser,
} from './migration/types';
export { transformSqliteValue } from './migration/value-transform';

export interface MigrateSqliteDatabaseOptions {
  sourcePath: string;
  client: DatabaseClient;
  allowNonemptyTarget?: boolean;
  backupDirectory?: string;
  now?: Date;
  runMigrations?: (client: DatabaseClient) => Promise<PostgresMigrationResult>;
  validateTargetSchema?: (client: DatabaseClient) => Promise<void>;
  verifyMigration?: typeof verifyDatabaseMigration;
  protectedPaths?: readonly string[];
  prepareSource?: typeof prepareSqliteSource;
  afterBusinessTablesLocked?: () => Promise<void>;
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
  const columns = await client.query<TargetColumnMetadata>(`
    SELECT table_name, column_name, udt_name, is_nullable, is_identity,
           identity_generation, column_default, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = current_schema()
    ORDER BY table_name, ordinal_position
  `);
  const constraints = await client.query<TargetConstraintMetadata>(`
    SELECT tc.table_name, tc.constraint_type, kcu.column_name,
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name,
           rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = tc.constraint_schema
     AND kcu.constraint_name = tc.constraint_name
    LEFT JOIN information_schema.referential_constraints rc
      ON rc.constraint_schema = tc.constraint_schema
     AND rc.constraint_name = tc.constraint_name
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_schema = tc.constraint_schema
     AND ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = current_schema()
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
    ORDER BY tc.table_name, tc.constraint_type, kcu.ordinal_position
  `);
  const indexes = await client.query<TargetIndexMetadata>(`
    SELECT table_relation.relname AS table_name,
           index_relation.relname AS index_name,
           index_state.indisunique AS is_unique,
           array_to_string(ARRAY(
             SELECT pg_get_indexdef(index_state.indexrelid, position, true)
             FROM generate_series(1, index_state.indnkeyatts) AS key_positions(position)
             ORDER BY position
           ), ', ') AS key_definitions
    FROM pg_catalog.pg_index index_state
    JOIN pg_catalog.pg_class index_relation
      ON index_relation.oid = index_state.indexrelid
    JOIN pg_catalog.pg_class table_relation
      ON table_relation.oid = index_state.indrelid
    JOIN pg_catalog.pg_namespace table_namespace
      ON table_namespace.oid = table_relation.relnamespace
    WHERE table_namespace.nspname = current_schema()
      AND NOT index_state.indisprimary
    ORDER BY table_relation.relname, index_relation.relname
  `);
  assertTargetSchemaContract(
    loadCanonicalTargetSchemaContract(),
    columns.rows,
    constraints.rows,
    new Set(MIGRATION_TABLES.map(({ name }) => name)),
    indexes.rows,
  );
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
    await transactionClient.query("SET LOCAL lock_timeout = '5s'");
    const businessTables = MIGRATION_TABLES.map(({ name }) => name).sort();
    await transactionClient.query(
      `LOCK TABLE ${businessTables.map(quoteIdentifier).join(', ')} IN ACCESS EXCLUSIVE MODE`,
    );
    await options.afterBusinessTablesLocked?.();

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
    const prepared = (options.prepareSource ?? prepareSqliteSource)(options.sourcePath, {
      backupDirectory: options.backupDirectory,
      now: options.now,
      protectedPaths: options.protectedPaths,
    });
    const sourceAfterBackup = readSqliteSnapshot(options.sourcePath);
    if (fingerprintSnapshot(sourceAfterBackup) !== sourceFingerprint) {
      throw new Error('SQLite source changed during backup creation; retry after writers are stopped.');
    }
    const snapshot = readSqliteSnapshot(prepared.backupPath);
    if (fingerprintSnapshot(snapshot) !== sourceFingerprint) {
      throw new Error('SQLite backup fingerprint does not match the checked source.');
    }
    const migrationVersions = await targetMigrationVersions(transactionClient);
    const imported = await importSqliteSnapshot(transactionClient, snapshot);
    const verification = await verifyMigration({
      sourcePath: prepared.backupPath,
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
        tableCounts: Object.fromEntries(Object.entries(prepared.baseline.tables)
          .map(([name, table]) => [name, table.count])),
        quoteCounts: Object.fromEntries(Object.entries(prepared.baseline.aggregates)
          .map(([name, aggregate]) => [name, aggregate.count])),
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
  rows: RowVerificationReport = { success: true, tables: {} },
): MigrationVerificationReport {
  const tables = Object.fromEntries(MIGRATION_TABLES.map(({ name }) => {
    const sourceTable = source.tables[name] ?? { count: 0, primaryKey: null };
    const targetTable = target.tables[name] ?? { count: 0, primaryKey: null };
    return [name, {
      sourceCount: sourceTable.count,
      targetCount: targetTable.count,
      countMatches: sourceTable.count === targetTable.count,
      primaryKeyMatches: rangesEqual(sourceTable.primaryKey, targetTable.primaryKey),
    }];
  }));
  const targetUsers = new Map(target.users.map((user) => [user.id, user]));
  const users = source.users.map((user) => {
    const targetUser = targetUsers.get(user.id);
    return {
      identifier: createHash('sha256').update(JSON.stringify(['users', user.id])).digest('hex').slice(0, 24),
      usernameMatches: user.username === targetUser?.username,
      roleMatches: user.role === targetUser?.role,
      activeMatches: user.isActive === targetUser?.isActive,
      passwordHashMatches: targetUser?.passwordHashMatches
        ?? (user.passwordHash !== undefined && user.passwordHash === targetUser?.passwordHash),
    };
  });
  const aggregates = Object.fromEntries(
    (['engineering_quotes', 'maintenance_quotes'] as const).map((name) => [name, {
      sourceCount: source.aggregates[name].count,
      targetCount: target.aggregates[name].count,
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
    && Object.values(identities).every(({ safe }) => safe)
    && rows.success;
  return {
    success,
    tables,
    aggregates,
    users,
    authSessionTokenHashesMatch,
    orphans,
    identities: Object.fromEntries(Object.entries(identities).map(([name, identity]) => [name, {
      safe: identity.safe,
    }])),
    rows,
    ignoredSourceTables: source.ignoredSourceTables,
  };
}

export function buildMigrationRowVerification(
  source: MigrationSnapshot,
  targetRows: Readonly<Record<string, readonly CanonicalRow[]>>,
): RowVerificationReport {
  return buildRowVerification({
    tables: MIGRATION_TABLES,
    sourceRows: source.rows,
    sourceColumns: source.sourceColumns,
    targetRows,
    booleanColumns: BOOLEAN_COLUMNS,
    moneyColumns: MONEY_COLUMNS,
    jsonColumns: JSON_COLUMNS,
    nullableTemporalColumns: NULLABLE_TEMPORAL_COLUMNS,
    timestampColumns: TIMESTAMP_COLUMNS,
  });
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
  for (const table of POLYMORPHIC_QUOTE_TABLES) {
    const result = await client.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM ${quoteIdentifier(table)} child
      LEFT JOIN "engineering_quotes" engineering
        ON child."quote_type" = 'engineering' AND child."quote_id" = engineering."id"
      LEFT JOIN "maintenance_quotes" maintenance
        ON child."quote_type" = 'maintenance' AND child."quote_id" = maintenance."id"
      WHERE child."quote_id" IS NOT NULL
        AND (
          (child."quote_type" = 'engineering' AND engineering."id" IS NULL)
          OR (child."quote_type" = 'maintenance' AND maintenance."id" IS NULL)
          OR child."quote_type" NOT IN ('engineering', 'maintenance')
          OR child."quote_type" IS NULL
        )
    `);
    orphans[polymorphicOrphanKey(table)] = parseCount(result.rows[0]);
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

async function collectTargetRows(
  client: DatabaseClient,
  sourceColumns: Readonly<Record<string, readonly string[]>>,
): Promise<Record<string, CanonicalRow[]>> {
  const rows: Record<string, CanonicalRow[]> = {};
  for (const table of MIGRATION_TABLES) {
    const columns = sourceColumns[table.name] ?? [];
    if (columns.length === 0) {
      rows[table.name] = [];
      continue;
    }
    const projections = columns.map((column) => (
      `CASE WHEN ${quoteIdentifier(column)} IS NULL THEN NULL ELSE ${quoteIdentifier(column)}::text END AS ${quoteIdentifier(column)}`
    ));
    const result = await client.query<CanonicalRow>(
      `SELECT ${projections.join(', ')} FROM ${quoteIdentifier(table.name)} ORDER BY ${quoteIdentifier(table.primaryKey)}`,
    );
    rows[table.name] = result.rows;
  }
  return rows;
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
  const snapshot = readSqliteSnapshot(options.sourcePath);
  const source = snapshot.summary;
  const target = await collectTargetSummary(options.client);
  const identities = await collectIdentitySummary(options.client);
  const targetRows = await collectTargetRows(options.client, snapshot.sourceColumns);
  const rows = buildMigrationRowVerification(snapshot, targetRows);
  const report = buildMigrationVerification(source, target, identities, rows);
  if (!report.success) throw new MigrationVerificationError(report);
  return report;
}
