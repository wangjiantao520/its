import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { runPostgresMigrations } from '../src/lib/database/postgres-migrations';
import {
  MIGRATION_GROUPS,
  MIGRATION_TABLES,
  assertSafeSourceTables,
  assertTargetSchemaContract,
  assertTargetReadyForImport,
  buildMigrationRowVerification,
  buildMigrationVerification,
  importSqliteSnapshot,
  loadCanonicalTargetSchemaContract,
  migrateSqliteDatabase,
  preflightJsonReport,
  prepareSqliteSource,
  readSqliteSnapshot,
  transformSqliteValue,
  verifyDatabaseMigration,
  writeJsonReportAtomic,
  type DatabaseImportReport,
  type CanonicalRow,
  type MigrationSnapshot,
  type TargetColumnMetadata,
  type TargetConstraintMetadata,
  type TargetIndexMetadata,
} from '../scripts/database/sqlite-postgres-migration';
import { runImportCli } from '../scripts/migrate-sqlite-to-postgres.mts';
import { runVerifyCli } from '../scripts/verify-database-migration.mts';
import {
  createPostgresTestHarness,
  POSTGRES_TEST_SKIP_REASON,
} from './helpers/postgres';
import {
  buildCanonicalPostgresManifest,
  serializableManifest,
} from './helpers/postgres-schema';

type Row = Record<string, unknown>;

interface PreservedFileState {
  digest: string;
  size: number;
  mtimeMs: number;
}

function preservedFileState(filePath: string): PreservedFileState {
  const stat = fs.statSync(filePath);
  return {
    digest: createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

interface SqliteStatement {
  run(...params: unknown[]): unknown;
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (filename: string) => SqliteDatabase;
}

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as NodeSqliteModule;

function temporaryDirectory(t: test.TestContext): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'its-sqlite-pg-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function createFixture(t: test.TestContext, options: { populatedObsolete?: boolean } = {}): string {
  const directory = temporaryDirectory(t);
  const databasePath = path.join(directory, 'quotation.db');
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      created_by TEXT
    );
    CREATE TABLE auth_sessions (
      token_hash TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      user_id INTEGER,
      username TEXT,
      name TEXT,
      expires_at INTEGER NOT NULL,
      created_at DATETIME NOT NULL,
      last_seen_at DATETIME NOT NULL
    );
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
    CREATE TABLE engineering_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT NOT NULL UNIQUE,
      version INTEGER,
      project_name TEXT NOT NULL,
      client_id INTEGER,
      subtotal REAL,
      tax REAL,
      total REAL,
      status TEXT,
      items TEXT,
      created_by TEXT,
      created_by_name TEXT,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
    CREATE TABLE maintenance_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT NOT NULL UNIQUE,
      version INTEGER,
      project_name TEXT NOT NULL,
      client_id INTEGER,
      subtotal REAL,
      tax REAL,
      total REAL,
      devices TEXT,
      status TEXT,
      created_by TEXT,
      created_by_name TEXT,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
    CREATE TABLE quote_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      quote_type TEXT NOT NULL,
      version INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_by TEXT,
      created_at DATETIME NOT NULL
    );
    CREATE TABLE quote_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      quote_id INTEGER NOT NULL,
      quote_type TEXT NOT NULL,
      password TEXT,
      expires_at DATETIME,
      is_active INTEGER NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
    CREATE TABLE quote_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      quote_type TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT,
      created_at DATETIME NOT NULL
    );
    CREATE TABLE labor_price_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      unit_price REAL NOT NULL,
      is_active INTEGER NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
    CREATE TABLE agent_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      system_prompt TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      created_by INTEGER,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
    CREATE TABLE agent_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      agent_id INTEGER,
      title TEXT,
      last_message TEXT,
      message_count INTEGER,
      last_message_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      is_deleted INTEGER NOT NULL
    );
    CREATE TABLE agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      agent_id INTEGER,
      session_id TEXT,
      user_message TEXT NOT NULL,
      agent_response TEXT NOT NULL,
      actions_executed TEXT,
      created_at DATETIME NOT NULL
    );
    CREATE TABLE ai_model_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      model_name TEXT NOT NULL,
      api_endpoint TEXT NOT NULL,
      api_key TEXT NOT NULL,
      is_active INTEGER NOT NULL,
      is_default INTEGER NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
    CREATE TABLE ai_models (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL);
  `);

  const timestamp = '2026-08-01T09:10:11.123Z';
  database.exec(`
    INSERT INTO users VALUES
      (7, 'admin', '$2b$admin-hash', '管理员', 'admin', 1, '${timestamp}', '${timestamp}', NULL),
      (11, 'member', '$2b$member-hash', '成员', 'its_member', 0, '${timestamp}', '${timestamp}', 'admin');
    INSERT INTO auth_sessions VALUES
      ('sha256:token-hash', 'admin', 7, 'admin', '管理员', 1999999999999, '${timestamp}', '${timestamp}');
    INSERT INTO clients VALUES (4, 'C-004', '客户甲', '${timestamp}', '${timestamp}');
    INSERT INTO engineering_quotes VALUES
      (13, 'ENG-013', 2, '工程甲', 4, 100.10, 13.01, 113.11, 'approved',
       '[{"name":"网关"}]', 'admin', '管理员', '${timestamp}', '${timestamp}');
    INSERT INTO maintenance_quotes VALUES
      (17, 'MAINT-017', 3, '维保甲', 4, 200.20, 26.03, 226.23,
       '[{"name":"交换机"}]', 'approved', 'member', '成员', '${timestamp}', '${timestamp}');
    INSERT INTO quote_versions VALUES
      (19, 13, 'engineering', 2, '{"total":113.11}', 'admin', '${timestamp}');
    INSERT INTO quote_shares VALUES
      (23, 'share-token-value', 13, 'engineering', '$2b$share-password', '', 1, '${timestamp}', '${timestamp}');
    INSERT INTO quote_audit_logs VALUES
      (29, 13, 'engineering', 'approve', 'admin', '${timestamp}');
    INSERT INTO labor_price_config VALUES
      (31, '高级', 888.88, 1, '${timestamp}', '${timestamp}');
    INSERT INTO agent_configs VALUES
      (37, '报价助手', '仅根据定额回答', 1, 7, '${timestamp}', '${timestamp}');
    INSERT INTO agent_sessions VALUES
      (41, 'session-41', 11, 37, '询价', '上次消息', 2, '${timestamp}', '${timestamp}', '${timestamp}', 0);
    INSERT INTO agent_logs VALUES
      (43, 11, 37, 'session-41', '请报价', '已计算', '[{"tool":"quote"}]', '${timestamp}');
    INSERT INTO ai_model_configs VALUES
      (47, '主模型', 'openai', 'gpt-test', 'https://example.invalid/v1', 'api-key-secret', 1, 1, '${timestamp}', '${timestamp}');
    INSERT INTO schema_migrations VALUES (8, 'unique-quote-version-numbers');
  `);
  if (options.populatedObsolete) {
    database.prepare('INSERT INTO ai_models (id, name) VALUES (?, ?)').run(1, 'legacy');
  }
  database.close();
  return databasePath;
}

function targetRowsFromSnapshot(snapshot: MigrationSnapshot): Record<string, CanonicalRow[]> {
  return Object.fromEntries(MIGRATION_TABLES.map(({ name }) => [name,
    (snapshot.rows[name] ?? []).map((sourceRow) => Object.fromEntries(
      (snapshot.sourceColumns[name] ?? []).map((column) => [
        column,
        sourceRow[column] === null
          ? null
          : transformSqliteValue(name, column, sourceRow[column]),
      ]),
    ) as CanonicalRow),
  ]));
}

function createDisjointFixture(t: test.TestContext): string {
  const databasePath = createFixture(t);
  const database = new DatabaseSync(databasePath);
  database.exec(`
    UPDATE users
      SET id = id + 100,
          username = username || '_other',
          created_by = CASE WHEN created_by IS NULL THEN NULL ELSE created_by || '_other' END;
    UPDATE auth_sessions
      SET token_hash = token_hash || '-other', user_id = user_id + 100,
          username = username || '_other';
    UPDATE clients SET id = id + 100, client_code = client_code || '-OTHER';
    UPDATE engineering_quotes
      SET id = id + 100, quote_number = quote_number || '-OTHER', client_id = client_id + 100,
          created_by = created_by || '_other';
    UPDATE maintenance_quotes
      SET id = id + 100, quote_number = quote_number || '-OTHER', client_id = client_id + 100,
          created_by = created_by || '_other';
    UPDATE quote_versions SET id = id + 100, quote_id = quote_id + 100,
          created_by = created_by || '_other';
    UPDATE quote_shares SET id = id + 100, token = token || '-other', quote_id = quote_id + 100;
    UPDATE quote_audit_logs SET id = id + 100, quote_id = quote_id + 100,
          operator = operator || '_other';
    UPDATE labor_price_config SET id = id + 100, level = level || '-other';
    UPDATE agent_configs
      SET id = id + 100, name = name || '-other', created_by = created_by + 100;
    UPDATE agent_sessions
      SET id = id + 100, session_id = session_id || '-other', user_id = user_id + 100,
          agent_id = agent_id + 100;
    UPDATE agent_logs
      SET id = id + 100, user_id = user_id + 100, agent_id = agent_id + 100,
          session_id = session_id || '-other';
    UPDATE ai_model_configs SET id = id + 100, name = name || '-other';
  `);
  database.close();
  return databasePath;
}

class RecordingClient implements DatabaseClient {
  readonly queries: Array<{ text: string; params: readonly unknown[]; transaction: number | null }> = [];
  readonly committed: Array<{ text: string; params: readonly unknown[]; transaction: number }> = [];
  transactionCount = 0;
  failOnTable: string | undefined;

  async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    this.queries.push({ text, params, transaction: null });
    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const transaction = ++this.transactionCount;
    const staged: Array<{ text: string; params: readonly unknown[]; transaction: number }> = [];
    const client: DatabaseClient = {
      query: async <ResultRow extends Row>(
        text: string,
        params: readonly unknown[] = [],
      ): Promise<QueryResult<ResultRow>> => {
        this.queries.push({ text, params, transaction });
        const failedTable = this.failOnTable;
        if (failedTable && text.startsWith(`INSERT INTO "${failedTable}"`)) {
          throw new Error('injected insert failure');
        }
        staged.push({ text, params, transaction });
        return { rows: [], rowCount: 1 };
      },
      transaction: async () => {
        throw new Error('nested transaction is not supported');
      },
      healthCheck: async () => {},
      close: async () => {},
    };
    const result = await work(client);
    this.committed.push(...staged);
    return result;
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

test('migration manifest exactly matches the Task 2 canonical PostgreSQL manifest', () => {
  const expected = serializableManifest(buildCanonicalPostgresManifest());
  const actual = Object.fromEntries(
    MIGRATION_TABLES.map(({ name, columns }) => [name, [...columns].sort()]),
  );
  assert.deepEqual(actual, expected);
});

test('source preparation uses an integrity-checked collision-safe SQLite backup', (t) => {
  const sourcePath = createFixture(t);
  const backupDirectory = path.join(path.dirname(sourcePath), 'backups');
  const now = new Date('2026-08-04T01:02:03.456Z');
  const prepared = prepareSqliteSource(sourcePath, { backupDirectory, now });

  assert.equal(prepared.sourceIntegrity, 'ok');
  assert.equal(prepared.backupIntegrity, 'ok');
  assert.ok(fs.existsSync(prepared.backupPath));
  assert.equal(prepared.baseline.tables.users.count, 2);
  assert.deepEqual(prepared.baseline.tables.users.primaryKey, { min: '7', max: '11' });
  assert.equal(prepared.baseline.aggregates.engineering_quotes.total, '113.11');

  assert.throws(
    () => prepareSqliteSource(sourcePath, { backupDirectory, now }),
    /backup already exists/i,
  );
});

test('source preparation rejects a corrupt SQLite source before creating a backup', (t) => {
  const directory = temporaryDirectory(t);
  const sourcePath = path.join(directory, 'corrupt.db');
  fs.writeFileSync(sourcePath, 'not a sqlite database');

  assert.throws(() => prepareSqliteSource(sourcePath), /integrity check failed/i);
  assert.equal(fs.existsSync(path.join(directory, 'backups')), false);
});

test('obsolete ai_models is ignored only when empty and unknown populated tables fail', (t) => {
  const emptyObsolete = createFixture(t);
  const snapshot = readSqliteSnapshot(emptyObsolete);
  assert.deepEqual(snapshot.ignoredSourceTables, ['ai_models', 'schema_migrations']);

  const populatedObsolete = createFixture(t, { populatedObsolete: true });
  assert.throws(() => readSqliteSnapshot(populatedObsolete), /ai_models.*manual mapping/i);

  const unknown = createFixture(t);
  const database = new DatabaseSync(unknown);
  database.exec('CREATE TABLE future_business (id INTEGER PRIMARY KEY); INSERT INTO future_business VALUES (1)');
  database.close();
  assert.throws(() => assertSafeSourceTables(unknown), /future_business.*not in the migration manifest/i);
});

test('recognized SQLite tables reject unexpected columns regardless of row count', (t) => {
  const populated = createFixture(t);
  const populatedDatabase = new DatabaseSync(populated);
  populatedDatabase.exec('ALTER TABLE users ADD COLUMN unreviewed_payload TEXT');
  populatedDatabase.close();
  assert.throws(() => readSqliteSnapshot(populated), /unexpected source column.*users.*unreviewed_payload/i);

  const empty = createFixture(t);
  const emptyDatabase = new DatabaseSync(empty);
  emptyDatabase.exec('CREATE TABLE device_quotas (id INTEGER PRIMARY KEY, unreviewed_payload TEXT)');
  emptyDatabase.close();
  assert.throws(() => readSqliteSnapshot(empty), /unexpected source column.*device_quotas.*unreviewed_payload/i);
});

test('bigint primary-key ranges and import parameters stay exact across MAX_SAFE_INTEGER', async (t) => {
  const sourcePath = createFixture(t);
  const database = new DatabaseSync(sourcePath);
  database.exec(`
    UPDATE users SET id = 9007199254740991 WHERE id = 7;
    UPDATE users SET id = 10000000000000000 WHERE id = 11;
    INSERT INTO users VALUES
      (9007199254740992, 'unsafe-middle', 'safe-hash', '中间', 'its_member', 1,
       '2026-08-01T09:10:11.123Z', '2026-08-01T09:10:11.123Z', NULL);
    UPDATE auth_sessions SET user_id = 9007199254740991;
    UPDATE agent_configs SET created_by = 9007199254740991;
    UPDATE agent_sessions SET user_id = 10000000000000000;
    UPDATE agent_logs SET user_id = 10000000000000000;
  `);
  database.close();

  const snapshot = readSqliteSnapshot(sourcePath);
  assert.deepEqual(snapshot.summary.tables.users.primaryKey, {
    min: '9007199254740991',
    max: '10000000000000000',
  });
  const client = new RecordingClient();
  await importSqliteSnapshot(client, snapshot);
  const userIds = client.committed
    .filter(({ text }) => text.startsWith('INSERT INTO "users"'))
    .map(({ params }) => String(params[0]));
  assert.deepEqual(userIds, [
    '9007199254740991',
    '9007199254740992',
    '10000000000000000',
  ]);
  assert.equal(
    client.queries.some(({ text, params }) => /setval\(pg_get_serial_sequence/i.test(text)
      && params[0] === 'users'),
    true,
  );
});

test('maps legacy null text primary keys to their unique preserved business item IDs', (t) => {
  const directory = temporaryDirectory(t);
  const sourcePath = path.join(directory, 'legacy-reference.db');
  const database = new DatabaseSync(sourcePath);
  database.exec(`
    CREATE TABLE self_construction_quotas (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      price REAL NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
    INSERT INTO self_construction_quotas
      (id, item_id, category, name, unit, price, created_at, updated_at)
    VALUES
      (NULL, 'SC-BUSINESS-001', '施工', '布线', '米', 12.34,
       '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  `);
  database.close();

  const snapshot = readSqliteSnapshot(sourcePath);
  assert.equal(snapshot.rows.self_construction_quotas[0].id, 'SC-BUSINESS-001');
  assert.deepEqual(
    snapshot.summary.tables.self_construction_quotas.primaryKey,
    { min: 'SC-BUSINESS-001', max: 'SC-BUSINESS-001' },
  );
  assert.equal(snapshot.summary.normalizations.self_construction_quotas, 1);
});

test('transforms only declared booleans, nullable empty timestamps, JSON, and exact money', () => {
  assert.equal(transformSqliteValue('users', 'is_active', 0), false);
  assert.equal(transformSqliteValue('agent_sessions', 'is_deleted', 1), true);
  assert.equal(transformSqliteValue('engineering_quotes', 'version', 1), 1);
  assert.equal(transformSqliteValue('intelligent_project_quotas', 'serial_number', 'IP-0200'), 200);
  assert.equal(transformSqliteValue('quote_shares', 'expires_at', ''), null);
  assert.throws(
    () => transformSqliteValue('users', 'created_at', ''),
    /non-null timestamp/i,
  );
  assert.throws(
    () => transformSqliteValue('users', 'created_at', null),
    /non-null timestamp/i,
  );
  assert.equal(
    transformSqliteValue('users', 'created_at', '2026-08-01 09:10:11'),
    '2026-08-01T09:10:11Z',
  );
  assert.equal(
    transformSqliteValue('users', 'created_at', '2026-08-01T09:10:11.123Z'),
    '2026-08-01T09:10:11.123Z',
  );
  assert.equal(transformSqliteValue('engineering_quotes', 'total', 1.005), '1.01');
  assert.equal(transformSqliteValue('engineering_quotes', 'total', 2.675), '2.68');
  assert.equal(transformSqliteValue('engineering_quotes', 'total', -1.005), '-1.01');
  assert.equal(transformSqliteValue('engineering_quotes', 'total', 113), '113.00');
  assert.equal(transformSqliteValue('engineering_quotes', 'total', '0.105'), '0.11');
  assert.equal(transformSqliteValue('engineering_quotes', 'total', '1.005e2'), '100.50');
  assert.throws(
    () => transformSqliteValue('engineering_quotes', 'total', '10000000000000000.00'),
    /numeric\(18,2\).*range/i,
  );
  assert.throws(
    () => transformSqliteValue('engineering_quotes', 'total', '0.0000000000000000001'),
    /numeric\(18,2\).*scale/i,
  );
  assert.throws(
    () => transformSqliteValue('engineering_quotes', 'total', Number.POSITIVE_INFINITY),
    /finite numeric/i,
  );
  assert.equal(transformSqliteValue('engineering_quotes', 'items', '[{"id":1}]'), '[{"id":1}]');
});

test('independent verification catches a deliberately faulty import money transformer', async (t) => {
  const sourcePath = createFixture(t);
  const database = new DatabaseSync(sourcePath);
  database.exec('UPDATE engineering_quotes SET subtotal = 1.005, tax = 0, total = 1.005');
  database.close();
  const snapshot = readSqliteSnapshot(sourcePath);
  assert.equal(snapshot.summary.aggregates.engineering_quotes.total, '1.01');

  const client = new RecordingClient();
  await importSqliteSnapshot(client, snapshot, {
    transformValue: (table, column, value) => table === 'engineering_quotes' && column === 'total'
      ? '1.00'
      : transformSqliteValue(table, column, value),
  });
  const quoteInsert = client.committed.find(({ text }) => text.startsWith('INSERT INTO "engineering_quotes"'));
  const totalIndex = snapshot.sourceColumns.engineering_quotes.indexOf('total');
  assert.equal(quoteInsert?.params[totalIndex], '1.00');

  const faultyTarget = structuredClone(snapshot.summary);
  faultyTarget.aggregates.engineering_quotes.total = '1.00';
  const verification = buildMigrationVerification(snapshot.summary, faultyTarget, {});
  assert.equal(verification.success, false);
  assert.equal(verification.aggregates.engineering_quotes.matches, false);
});

test('imports in deterministic dependency groups with parameterized inserts and resets identities', async (t) => {
  const snapshot = readSqliteSnapshot(createFixture(t));
  const client = new RecordingClient();
  const result = await importSqliteSnapshot(client, snapshot);

  assert.equal(client.transactionCount, MIGRATION_GROUPS.length);
  const insertedTables = client.committed
    .filter(({ text }) => text.startsWith('INSERT INTO'))
    .map(({ text }) => /^INSERT INTO "([^"]+)"/.exec(text)?.[1]);
  assert.deepEqual(insertedTables, [
    'users', 'users', 'clients', 'labor_price_config', 'ai_model_configs',
    'auth_sessions', 'engineering_quotes', 'maintenance_quotes', 'agent_configs',
    'quote_versions', 'quote_audit_logs', 'quote_shares', 'agent_sessions',
    'agent_logs',
  ]);
  assert.ok(client.committed.every(({ text }) => !text.includes('$2b$admin-hash')));
  const adminInsert = client.committed.find(({ text }) => text.startsWith('INSERT INTO "users"'));
  assert.ok(adminInsert?.text.includes('$1'));
  assert.equal(adminInsert?.params[0], 7);
  assert.equal(adminInsert?.params[2], '$2b$admin-hash');
  assert.equal(result.importedCounts.users, 2);

  const identityResets = client.queries.filter(({ text }) => /setval\(pg_get_serial_sequence/i.test(text));
  assert.ok(identityResets.length > 0);
  assert.ok(identityResets.every(({ text }) => /max\("id"\) IS NOT NULL/i.test(text)));
});

test('rolls back the complete logical dependency group when one insert fails', async (t) => {
  const snapshot = readSqliteSnapshot(createFixture(t));
  const client = new RecordingClient();
  client.failOnTable = 'engineering_quotes';

  await assert.rejects(() => importSqliteSnapshot(client, snapshot), /injected insert failure/);
  assert.equal(
    client.committed.some(({ text }) => text.startsWith('INSERT INTO "auth_sessions"')),
    false,
  );
  assert.equal(
    client.committed.some(({ text }) => text.startsWith('INSERT INTO "users"')),
    true,
  );
});

test('migration verification succeeds exactly and reports mismatches without exposing hashes', (t) => {
  const source = readSqliteSnapshot(createFixture(t)).summary;
  const matching = structuredClone(source);
  const success = buildMigrationVerification(source, matching, {
    users: { sequenceValue: '11', maxId: '11', safe: true },
  });
  assert.equal(success.success, true);
  assert.equal(success.tables.users.sourceCount, 2);
  assert.equal(success.tables.users.targetCount, 2);
  assert.equal(
    success.aggregates.engineering_quotes.sourceCount,
    source.aggregates.engineering_quotes.count,
  );
  assert.deepEqual(success.identities.users, { safe: true });

  matching.tables.users.count = 1;
  matching.users[0].username = 'changed-admin';
  matching.users[0].passwordHashMatches = false;
  const mismatch = buildMigrationVerification(source, matching, {});
  assert.equal(mismatch.success, false);
  assert.equal(mismatch.users[0].usernameMatches, false);
  const serialized = JSON.stringify(mismatch);
  assert.equal(serialized.includes('$2b$admin-hash'), false);
  assert.equal(serialized.includes('sha256:token-hash'), false);
  assert.equal(serialized.includes('changed-admin'), false);
  assert.equal(serialized.includes('"sequenceValue"'), false);
  assert.equal(serialized.includes('"sourcePrimaryKey"'), false);
});

test('row verification rejects swapped row content despite equal counts and primary-key ranges', (t) => {
  const snapshot = readSqliteSnapshot(createFixture(t));
  const targetRows = targetRowsFromSnapshot(snapshot);
  const firstUsername = targetRows.users[0].username;
  targetRows.users[0].username = targetRows.users[1].username;
  targetRows.users[1].username = firstUsername;

  const report = buildMigrationRowVerification(snapshot, targetRows);
  assert.equal(report.success, false);
  assert.equal(report.tables.users.sourceCount, report.tables.users.targetCount);
  assert.equal(report.tables.users.mismatchedCount, 2);
  assert.equal(report.tables.users.missingCount, 0);
  assert.equal(report.tables.users.unexpectedCount, 0);
  assert.ok(report.tables.users.mismatchIdentifiers.every((identifier) => /^[a-f0-9]{24}$/.test(identifier)));
});

test('row verification rejects offsetting per-row money corruption and verifies each money column', (t) => {
  const snapshot = readSqliteSnapshot(createFixture(t));
  const original = snapshot.rows.engineering_quotes[0];
  snapshot.rows.engineering_quotes.push({ ...original, id: BigInt(44), quote_number: 'EQ-44' });
  const targetRows = targetRowsFromSnapshot(snapshot);
  targetRows.engineering_quotes[0].total = '112.11';
  targetRows.engineering_quotes[1].total = '114.11';

  const report = buildMigrationRowVerification(snapshot, targetRows);
  assert.equal(report.success, false);
  assert.equal(report.tables.engineering_quotes.mismatchedCount, 2);
  assert.equal(report.tables.engineering_quotes.moneyColumns.total.valuesMatch, false);
  assert.equal(report.tables.engineering_quotes.moneyColumns.total.matches, true);
  assert.equal(report.tables.engineering_quotes.moneyColumns.subtotal.valuesMatch, true);
});

test('row verification covers config, quota, labor, and device tables', (t) => {
  const base = readSqliteSnapshot(createFixture(t));
  const cases = [
    ['ai_model_configs', 'api_endpoint', 'https://wrong.invalid'],
    ['labor_price_config', 'unit_price', '999.99'],
    ['device_quotas', 'inspection_labor_fee', '888.88'],
    ['maintenance_device_quotas', 'annual_fee', '777.77'],
  ] as const;

  for (const [table, column, corruptValue] of cases) {
    const snapshot = structuredClone(base);
    if (snapshot.rows[table].length === 0) {
      snapshot.sourceColumns[table] = [...(MIGRATION_TABLES.find(({ name }) => name === table)?.columns ?? [])];
      snapshot.rows[table].push(Object.fromEntries(
        snapshot.sourceColumns[table].map((name) => [name, name === 'id' ? BigInt(9100) : null]),
      ));
    }
    const targetRows = targetRowsFromSnapshot(snapshot);
    targetRows[table][0][column] = corruptValue;
    const report = buildMigrationRowVerification(snapshot, targetRows);
    assert.equal(report.success, false, table);
    assert.equal(report.tables[table].mismatchedCount, 1, table);
  }
});

test('row verification covers ownership, status, and secret fields without reporting values', (t) => {
  const snapshot = readSqliteSnapshot(createFixture(t));
  const targetRows = targetRowsFromSnapshot(snapshot);
  targetRows.engineering_quotes[0].created_by = '11';
  targetRows.engineering_quotes[0].status = 'approved';
  targetRows.users[0].password_hash = '$2b$corrupted-secret';

  const report = buildMigrationRowVerification(snapshot, targetRows);
  assert.equal(report.success, false);
  assert.equal(report.tables.engineering_quotes.mismatchedCount, 1);
  assert.equal(report.tables.users.mismatchedCount, 1);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('$2b$admin-hash'), false);
  assert.equal(serialized.includes('$2b$corrupted-secret'), false);
  assert.equal(serialized.includes('approved'), false);
});

test('row verification treats empty optional source dates as target nulls', (t) => {
  const sourcePath = createFixture(t);
  const database = new DatabaseSync(sourcePath);
  database.exec("ALTER TABLE engineering_quotes ADD COLUMN quote_date TEXT; UPDATE engineering_quotes SET quote_date = ''");
  database.close();
  const snapshot = readSqliteSnapshot(sourcePath);
  const targetRows = targetRowsFromSnapshot(snapshot);

  const report = buildMigrationRowVerification(snapshot, targetRows);
  assert.equal(report.success, true);
  assert.equal(report.tables.engineering_quotes.rowsMatch, true);
  assert.deepEqual(report.tables.engineering_quotes.columns.quote_date, {
    sourceNullCount: 1,
    targetNullCount: 1,
    matches: true,
  });
});

test('row verification preserves unsafe JSON integers through nested deterministic canonicalization', (t) => {
  const snapshot = readSqliteSnapshot(createFixture(t));
  snapshot.rows.engineering_quotes[0].items = '[{"outer":{"b":2,"a":[9007199254740992,{"deep":true}]}}]';
  const targetRows = targetRowsFromSnapshot(snapshot);
  targetRows.engineering_quotes[0].items = '[{"outer":{"a":[9007199254740992,{"deep":true}],"b":2}}]';

  const reordered = buildMigrationRowVerification(snapshot, targetRows);
  assert.equal(reordered.success, true);

  targetRows.engineering_quotes[0].items = '[{"outer":{"a":[9007199254740993,{"deep":true}],"b":2}}]';
  const adjacentInteger = buildMigrationRowVerification(snapshot, targetRows);
  assert.equal(adjacentInteger.success, false);
  assert.equal(adjacentInteger.tables.engineering_quotes.mismatchedCount, 1);
});

test('verification detects polymorphic quote orphans across versions, shares, audits, and history', (t) => {
  const sourcePath = createFixture(t);
  const database = new DatabaseSync(sourcePath);
  database.exec(`
    UPDATE quote_versions SET quote_id = 999999;
    UPDATE quote_shares SET quote_type = 'unknown';
    UPDATE quote_audit_logs SET quote_id = 999999;
    CREATE TABLE quote_device_history (
      id INTEGER PRIMARY KEY,
      client_id INTEGER,
      client_name TEXT,
      device_signature TEXT,
      device_data TEXT,
      quote_total REAL,
      quote_id INTEGER,
      quote_type TEXT,
      created_at TEXT
    );
    INSERT INTO quote_device_history
      (id, client_id, client_name, device_signature, device_data, quote_total, quote_id, quote_type, created_at)
    VALUES
      (8101, 3, 'Client A', 'sig', '{}', 1.00, 999999, 'maintenance', '2026-08-01 09:10:11');
  `);
  database.close();

  const summary = readSqliteSnapshot(sourcePath).summary;
  assert.equal(summary.orphans['quote_versions.quote_id+quote_type->engineering_quotes|maintenance_quotes'], 1);
  assert.equal(summary.orphans['quote_shares.quote_id+quote_type->engineering_quotes|maintenance_quotes'], 1);
  assert.equal(summary.orphans['quote_audit_logs.quote_id+quote_type->engineering_quotes|maintenance_quotes'], 1);
  assert.equal(summary.orphans['quote_device_history.quote_id+quote_type->engineering_quotes|maintenance_quotes'], 1);

  const target = structuredClone(summary);
  target.orphans['quote_versions.quote_id+quote_type->engineering_quotes|maintenance_quotes'] = 0;
  const report = buildMigrationVerification(summary, target, {});
  assert.equal(report.success, false);
  assert.equal(
    report.orphans['quote_versions.quote_id+quote_type->engineering_quotes|maintenance_quotes'].matches,
    false,
  );
});

test('target schema contract rejects column, constraint, and migration-002 index drift', () => {
  const expected = loadCanonicalTargetSchemaContract();
  const includedTables = new Set(MIGRATION_TABLES.map(({ name }) => name));
  const columns: TargetColumnMetadata[] = expected.columns
    .filter(({ tableName }) => includedTables.has(tableName))
    .map((column) => ({
      table_name: column.tableName,
      column_name: column.columnName,
      udt_name: column.udtName,
      is_nullable: column.nullable ? 'YES' : 'NO',
      is_identity: column.identity ? 'YES' : 'NO',
      identity_generation: column.identityGeneration,
      column_default: column.defaultExpression,
      numeric_precision: column.numericPrecision,
      numeric_scale: column.numericScale,
    }));
  const constraints: TargetConstraintMetadata[] = expected.constraints
    .filter(({ tableName }) => includedTables.has(tableName))
    .map((constraint) => ({
      table_name: constraint.tableName,
      constraint_type: constraint.constraintType,
      column_name: constraint.columnName,
      foreign_table_name: constraint.foreignTableName,
      foreign_column_name: constraint.foreignColumnName,
      delete_rule: constraint.deleteRule,
    }));

  assert.ok(expected.indexes.length, 'canonical target schema must include migration-002 indexes');
  const indexes: TargetIndexMetadata[] = expected.indexes.map((index) => ({
    table_name: index.tableName,
    index_name: index.indexName,
    is_unique: index.unique,
    key_definitions: index.keyDefinitions.join(', '),
  }));

  assert.doesNotThrow(() => assertTargetSchemaContract(
    expected,
    columns,
    constraints,
    includedTables,
    indexes,
  ));

  const corruptions: Array<(values: TargetColumnMetadata[]) => void> = [
    (values) => { values.find(({ table_name, column_name }) => table_name === 'users' && column_name === 'id')!.udt_name = 'int4'; },
    (values) => { values.find(({ table_name, column_name }) => table_name === 'engineering_quotes' && column_name === 'total')!.numeric_precision = 19; },
    (values) => { values.find(({ table_name, column_name }) => table_name === 'engineering_quotes' && column_name === 'total')!.numeric_scale = 3; },
    (values) => { values.find(({ table_name, column_name }) => table_name === 'users' && column_name === 'role')!.column_default = "'unexpected_role'"; },
    (values) => { values.find(({ table_name, column_name }) => table_name === 'users' && column_name === 'username')!.is_nullable = 'YES'; },
    (values) => { values.find(({ table_name, column_name }) => table_name === 'users' && column_name === 'id')!.is_identity = 'NO'; },
  ];
  for (const corrupt of corruptions) {
    const changed = structuredClone(columns);
    corrupt(changed);
    assert.throws(
      () => assertTargetSchemaContract(expected, changed, constraints, includedTables, indexes),
      /canonical manifest/i,
    );
  }

  const missingForeignKey = constraints.filter((constraint) => !(
    constraint.table_name === 'quotation_devices'
    && constraint.constraint_type === 'FOREIGN KEY'
  ));
  assert.throws(
    () => assertTargetSchemaContract(expected, columns, missingForeignKey, includedTables, indexes),
    /constraints.*canonical manifest/i,
  );

  const missingPrimaryKey = constraints.filter((constraint) => !(
    constraint.table_name === 'users'
    && constraint.constraint_type === 'PRIMARY KEY'
  ));
  assert.throws(
    () => assertTargetSchemaContract(expected, columns, missingPrimaryKey, includedTables, indexes),
    /constraints.*canonical manifest/i,
  );

  const missingUniqueConstraint = constraints.filter((constraint) => !(
    constraint.table_name === 'users'
    && constraint.constraint_type === 'UNIQUE'
    && constraint.column_name === 'username'
  ));
  assert.throws(
    () => assertTargetSchemaContract(expected, columns, missingUniqueConstraint, includedTables, indexes),
    /constraints.*canonical manifest/i,
  );

  for (const requiredIndex of ['idx_quote_versions_quote', 'idx_quote_shares_token']) {
    const missingIndex = indexes.filter(({ index_name }) => index_name !== requiredIndex);
    assert.throws(
      () => assertTargetSchemaContract(expected, columns, constraints, includedTables, missingIndex),
      /indexes.*canonical manifest/i,
    );
  }

  const changedIndex = structuredClone(indexes);
  changedIndex.find(({ index_name }) => index_name === 'idx_quote_versions_quote')!.key_definitions = 'quote_id, quote_type, version';
  assert.throws(
    () => assertTargetSchemaContract(expected, columns, constraints, includedTables, changedIndex),
    /indexes.*canonical manifest/i,
  );

  const nonUniqueIndex = structuredClone(indexes);
  nonUniqueIndex.find(({ index_name }) => index_name === 'idx_quote_shares_token')!.is_unique = false;
  assert.throws(
    () => assertTargetSchemaContract(expected, columns, constraints, includedTables, nonUniqueIndex),
    /indexes.*canonical manifest/i,
  );
});

test('atomic report contains no URLs, password hashes, or token hashes', (t) => {
  const directory = temporaryDirectory(t);
  const reportPath = path.join(directory, 'report.json');
  writeJsonReportAtomic(reportPath, {
    success: true,
    importedCounts: { users: 2 },
    verification: { passwordHashMatches: true, tokenHashMatches: true },
  });
  const report = fs.readFileSync(reportPath, 'utf8');
  assert.match(report, /"success": true/);
  assert.equal(report.includes('postgres://'), false);
  assert.equal(report.includes('$2b$'), false);
  assert.equal(report.includes('sha256:'), false);
  assert.deepEqual(
    fs.readdirSync(directory).sort(),
    ['report.json'],
  );
});

async function assertCliRejectsSourceReportAlias(
  t: test.TestContext,
  cli: 'import' | 'verify',
  aliasKind: 'same' | 'relative' | 'symlink' | 'hardlink',
): Promise<void> {
  const sourcePath = createFixture(t);
  const before = preservedFileState(sourcePath);
  let reportPath: string;
  if (aliasKind === 'same') {
    reportPath = sourcePath;
  } else if (aliasKind === 'relative') {
    reportPath = path.relative(process.cwd(), sourcePath);
  } else {
    reportPath = path.join(path.dirname(sourcePath), `${aliasKind}-report.json`);
    if (aliasKind === 'symlink') fs.symlinkSync(sourcePath, reportPath);
    else fs.linkSync(sourcePath, reportPath);
  }
  let clientCreated = false;
  const dependencies = {
    argv: [
      '--source', sourcePath,
      '--report', reportPath,
      ...(cli === 'import' ? ['--maintenance-mode-confirmed'] : []),
    ],
    env: { DATABASE_MIGRATION_URL: 'postgres://redacted.invalid/db' },
    createClient: (): DatabaseClient => {
      clientCreated = true;
      throw new Error('client must not be created for an unsafe report path');
    },
    writeStdout: () => {},
    writeStderr: () => {},
  };
  const exitCode = cli === 'import'
    ? await runImportCli(dependencies)
    : await runVerifyCli(dependencies);
  assert.equal(exitCode, 1);
  assert.equal(clientCreated, false);
  assert.deepEqual(preservedFileState(sourcePath), before);
}

test('import CLI rejects same, relative, symlink, and hardlink source/report aliases before DB work', async (t) => {
  for (const aliasKind of ['same', 'relative', 'symlink', 'hardlink'] as const) {
    await t.test(aliasKind, async (subtest) => {
      await assertCliRejectsSourceReportAlias(subtest, 'import', aliasKind);
    });
  }
});

test('verification CLI rejects same, relative, symlink, and hardlink source/report aliases before DB work', async (t) => {
  for (const aliasKind of ['same', 'relative', 'symlink', 'hardlink'] as const) {
    await t.test(aliasKind, async (subtest) => {
      await assertCliRejectsSourceReportAlias(subtest, 'verify', aliasKind);
    });
  }
});

test('atomic report writer refuses protected path and inode aliases without replacing data', (t) => {
  for (const aliasKind of ['same', 'relative', 'symlink', 'hardlink'] as const) {
    const sourcePath = createFixture(t);
    const before = preservedFileState(sourcePath);
    let reportPath: string;
    if (aliasKind === 'same') reportPath = sourcePath;
    else if (aliasKind === 'relative') reportPath = path.relative(process.cwd(), sourcePath);
    else {
      reportPath = path.join(path.dirname(sourcePath), `${aliasKind}-writer.json`);
      if (aliasKind === 'symlink') fs.symlinkSync(sourcePath, reportPath);
      else fs.linkSync(sourcePath, reportPath);
    }
    assert.throws(
      () => writeJsonReportAtomic(reportPath, { success: true }, { protectedPaths: [sourcePath] }),
      /protected|overlap|same file/i,
    );
    assert.deepEqual(preservedFileState(sourcePath), before);
  }
});

test('backup creation refuses a generated path reserved for the report', (t) => {
  const sourcePath = createFixture(t);
  const before = preservedFileState(sourcePath);
  const backupDirectory = temporaryDirectory(t);
  const now = new Date('2026-08-04T00:00:00.000Z');
  const generatedBackupPath = path.join(
    backupDirectory,
    'quotation.migration-2026-08-04T00-00-00-000Z.db',
  );
  assert.throws(
    () => prepareSqliteSource(sourcePath, {
      backupDirectory,
      now,
      protectedPaths: [generatedBackupPath],
    }),
    /protected|overlap|same file/i,
  );
  assert.equal(fs.existsSync(generatedBackupPath), false);
  assert.deepEqual(preservedFileState(sourcePath), before);
});

class NonemptyTargetClient extends RecordingClient {
  override async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    this.queries.push({ text, params, transaction: null });
    if (/SELECT count\(\*\).*FROM "users"/i.test(text)) {
      return { rows: [{ count: '1' }] as unknown as ResultRow[], rowCount: 1 };
    }
    return { rows: [{ count: '0' }] as unknown as ResultRow[], rowCount: 1 };
  }
}

test('independent verifier fails when target row counts mismatch', async (t) => {
  const sourcePath = createFixture(t);
  const client = new NonemptyTargetClient();
  await assert.rejects(
    () => verifyDatabaseMigration({ sourcePath, client }),
    /verification failed/i,
  );
});

class TargetStateClient extends RecordingClient {
  constructor(
    private readonly businessRows: Readonly<Record<string, number>>,
  ) {
    super();
  }

  override async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    this.queries.push({ text, params, transaction: null });
    const table = /FROM "([a-z_]+)"/i.exec(text)?.[1];
    const count = table ? this.businessRows[table] ?? 0 : 0;
    return { rows: [{ count: String(count) }] as unknown as ResultRow[], rowCount: 1 };
  }
}

test('refuses existing migration metadata without override and always refuses business rows', async () => {
  const metadataOnly = new TargetStateClient({});
  await assert.rejects(
    () => assertTargetReadyForImport(metadataOnly, {
      allowNonemptyTarget: false,
      hadMigrationMetadata: true,
    }),
    /already contains schema metadata/i,
  );
  await assert.doesNotReject(
    () => assertTargetReadyForImport(metadataOnly, {
      allowNonemptyTarget: true,
      hadMigrationMetadata: true,
    }),
  );

  const populated = new TargetStateClient({ users: 1 });
  await assert.rejects(
    () => assertTargetReadyForImport(populated, {
      allowNonemptyTarget: true,
      hadMigrationMetadata: true,
    }),
    /business rows/i,
  );
});

test('migration CLIs provide help and redact malformed target credentials', () => {
  const importHelp = spawnSync('pnpm', ['db:import-sqlite', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(importHelp.status, 0, importHelp.stderr);
  assert.match(importHelp.stdout, /--source[\s\S]*--report/);
  assert.doesNotMatch(importHelp.stdout, /--target/);
  assert.match(importHelp.stdout, /--allow-nonempty-target/);
  assert.match(importHelp.stdout, /--maintenance-mode-confirmed/);

  const verifyHelp = spawnSync('pnpm', ['db:verify-migration', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(verifyHelp.status, 0, verifyHelp.stderr);
  assert.match(verifyHelp.stdout, /--source[\s\S]*--report/);
  assert.doesNotMatch(verifyHelp.stdout, /--target/);

  const username = 'migration_user_secret';
  const password = 'migration_password_secret';
  const target = `postgres://${username}:${password}@[invalid-host`;
  const failed = spawnSync(
    'pnpm',
    [
      'db:import-sqlite', '--source', '/missing/source.db',
      '--report', '/tmp/unused-report.json', '--maintenance-mode-confirmed',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, DATABASE_MIGRATION_URL: target },
    },
  );
  const output = `${failed.stdout}${failed.stderr}`;
  assert.notEqual(failed.status, 0);
  for (const secret of [target, username, password]) assert.equal(output.includes(secret), false);
});

test('migration CLIs reject target URL arguments before creating a client', async (t) => {
  const sourcePath = createFixture(t);
  const directory = temporaryDirectory(t);
  const target = 'postgres://argument-user:argument-password@invalid/db';
  for (const cli of ['import', 'verify'] as const) {
    let clientCreated = false;
    const messages: string[] = [];
    const dependencies = {
      argv: [
        '--source', sourcePath,
        '--target', target,
        '--report', path.join(directory, `${cli}-report.json`),
        ...(cli === 'import' ? ['--maintenance-mode-confirmed'] : []),
      ],
      env: { DATABASE_MIGRATION_URL: 'postgres://environment.invalid/db' },
      createClient: (): DatabaseClient => {
        clientCreated = true;
        throw new Error('client must not be created for a rejected target argument');
      },
      writeStdout: (message: string) => messages.push(message),
      writeStderr: (message: string) => messages.push(message),
    };
    const exitCode = cli === 'import'
      ? await runImportCli(dependencies)
      : await runVerifyCli(dependencies);
    assert.equal(exitCode, 1, cli);
    assert.equal(clientCreated, false, cli);
    assert.equal(messages.join('\n').includes(target), false, cli);
    assert.equal(messages.join('\n').includes('argument-password'), false, cli);
  }
});

test('import CLI requires explicit maintenance-mode confirmation before DB work', async (t) => {
  const sourcePath = createFixture(t);
  const reportPath = path.join(temporaryDirectory(t), 'report.json');
  let clientCreatedWithoutConfirmation = false;
  const withoutConfirmation = await runImportCli({
    argv: ['--source', sourcePath, '--report', reportPath],
    env: { DATABASE_MIGRATION_URL: 'postgres://redacted.invalid/db' },
    createClient: () => {
      clientCreatedWithoutConfirmation = true;
      throw new Error('must not create client');
    },
    writeStdout: () => {},
    writeStderr: () => {},
  });
  assert.equal(withoutConfirmation, 1);
  assert.equal(clientCreatedWithoutConfirmation, false);

  let clientCreatedWithConfirmation = false;
  await runImportCli({
    argv: [
      '--source', sourcePath,
      '--report', reportPath,
      '--maintenance-mode-confirmed',
    ],
    env: { DATABASE_MIGRATION_URL: 'postgres://redacted.invalid/db' },
    createClient: () => {
      clientCreatedWithConfirmation = true;
      throw new Error('confirmation accepted');
    },
    writeStdout: () => {},
    writeStderr: () => {},
  });
  assert.equal(clientCreatedWithConfirmation, true);
});

interface LedgerClientState {
  businessCounts: Record<string, number>;
  ledger: Map<string, DatabaseImportReport>;
  businessInsertCount: number;
}

class LedgerRecordingClient implements DatabaseClient {
  private state: LedgerClientState = {
    businessCounts: {},
    ledger: new Map(),
    businessInsertCount: 0,
  };

  get completedRuns(): number {
    return this.state.ledger.size;
  }

  get insertedBusinessRows(): number {
    return this.state.businessInsertCount;
  }

  private cloneState(source: LedgerClientState): LedgerClientState {
    return {
      businessCounts: { ...source.businessCounts },
      ledger: new Map(source.ledger),
      businessInsertCount: source.businessInsertCount,
    };
  }

  private createScopedClient(state: LedgerClientState): DatabaseClient {
    return {
      query: <ResultRow extends Row>(text: string, params: readonly unknown[] = []) =>
        this.executeQuery<ResultRow>(state, text, params),
      transaction: async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> => {
        const savepoint = this.cloneState(state);
        const result = await work(this.createScopedClient(savepoint));
        state.businessCounts = savepoint.businessCounts;
        state.ledger = savepoint.ledger;
        state.businessInsertCount = savepoint.businessInsertCount;
        return result;
      },
      healthCheck: async () => {},
      close: async () => {},
    };
  }

  private async executeQuery<ResultRow extends Row>(
    state: LedgerClientState,
    text: string,
    params: readonly unknown[],
  ): Promise<QueryResult<ResultRow>> {
    if (/to_regclass\('schema_migrations'\)/i.test(text)) {
      return { rows: [{ relation_name: null }] as unknown as ResultRow[], rowCount: 1 };
    }
    if (/SELECT\s+import_id,\s*report_json\s+FROM\s+sqlite_import_runs/i.test(text)) {
      const report = state.ledger.get(String(params[0]));
      return {
        rows: report ? [{ import_id: report.importId, report_json: report }] as unknown as ResultRow[] : [],
        rowCount: report ? 1 : 0,
      };
    }
    if (/INSERT\s+INTO\s+sqlite_import_runs/i.test(text)) {
      const fingerprint = String(params[1]);
      const report = JSON.parse(String(params[8])) as DatabaseImportReport;
      state.ledger.set(fingerprint, report);
      return { rows: [], rowCount: 1 };
    }
    if (/SELECT\s+version\s+FROM\s+schema_migrations/i.test(text)) {
      return {
        rows: [1, 2, 3].map((version) => ({ version })) as unknown as ResultRow[],
        rowCount: 3,
      };
    }
    const countTable = /SELECT count\(\*\)::text AS count FROM "([a-z_]+)"/i.exec(text)?.[1];
    if (countTable) {
      const count = state.businessCounts[countTable] ?? 0;
      return { rows: [{ count: String(count) }] as unknown as ResultRow[], rowCount: 1 };
    }
    const insertTable = /^INSERT INTO "([a-z_]+)"/i.exec(text)?.[1];
    if (insertTable) {
      state.businessCounts[insertTable] = (state.businessCounts[insertTable] ?? 0) + 1;
      state.businessInsertCount += 1;
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    return this.executeQuery<ResultRow>(this.state, text, params);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const transaction = this.cloneState(this.state);
    const result = await work(this.createScopedClient(transaction));
    this.state = transaction;
    return result;
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

test('completed ledger recovers a failed report write without duplicate imports', async (t) => {
  const sourcePath = createFixture(t);
  const directory = temporaryDirectory(t);
  const reportPath = path.join(directory, 'migration-report.json');
  const client = new LedgerRecordingClient();
  const messages: string[] = [];
  const migrateDatabase = (options: Parameters<typeof migrateSqliteDatabase>[0]) =>
    migrateSqliteDatabase({
      ...options,
      runMigrations: async () => ({ appliedVersions: [1, 2, 3] }),
      validateTargetSchema: async () => {},
      verifyMigration: async ({ sourcePath: verificationSource }) => {
        const summary = readSqliteSnapshot(verificationSource).summary;
        return buildMigrationVerification(summary, structuredClone(summary), {});
      },
    });
  const common = {
    env: { DATABASE_MIGRATION_URL: 'postgres://redacted.invalid/db' },
    createClient: () => client,
    migrateDatabase,
    preflightReport: preflightJsonReport,
    writeStdout: (message: string) => messages.push(message),
    writeStderr: (message: string) => messages.push(message),
  };

  const first = await runImportCli({
    ...common,
    argv: [
      '--source', sourcePath,
      '--report', reportPath,
      '--maintenance-mode-confirmed',
    ],
    writeReport: () => {
      throw new Error('injected report rename failure');
    },
  });
  assert.equal(first, 2);
  assert.equal(client.completedRuns, 1);
  assert.ok(client.insertedBusinessRows > 0);
  assert.equal(fs.existsSync(reportPath), false);
  assert.match(messages.join('\n'), /migration completed.*rerun.*report/i);

  const insertedAfterFirstRun = client.insertedBusinessRows;
  const second = await runImportCli({
    ...common,
    argv: [
      '--source', sourcePath,
      '--report', reportPath,
      '--maintenance-mode-confirmed',
    ],
    writeReport: writeJsonReportAtomic,
  });
  assert.equal(second, 0);
  assert.equal(client.completedRuns, 1);
  assert.equal(client.insertedBusinessRows, insertedAfterFirstRun);
  const recoveredReport = fs.readFileSync(reportPath, 'utf8');
  assert.match(recoveredReport, /"success": true/);
  for (const secret of ['$2b$admin-hash', 'sha256:token-hash', 'api-key-secret']) {
    assert.equal(recoveredReport.includes(secret), false);
  }

  const differentSource = createFixture(t);
  const differentDatabase = new DatabaseSync(differentSource);
  differentDatabase.exec("UPDATE users SET name = '不同来源' WHERE id = 7");
  differentDatabase.close();
  const different = await runImportCli({
    ...common,
    argv: [
      '--source', differentSource,
      '--report', path.join(directory, 'different-report.json'),
      '--maintenance-mode-confirmed',
    ],
    writeReport: writeJsonReportAtomic,
  });
  assert.equal(different, 1);
  assert.equal(client.completedRuns, 1);
  assert.equal(client.insertedBusinessRows, insertedAfterFirstRun);
  assert.equal(messages.join('\n').includes('$2b$admin-hash'), false);
  assert.equal(messages.join('\n').includes('sha256:token-hash'), false);
});

interface ConcurrentImportState {
  rows: Record<string, Set<string>>;
  ledger: Map<string, DatabaseImportReport>;
  sequences: Record<string, number>;
  insertedBusinessRows: number;
  ledgerInserts: number;
  migrationMetadata: boolean;
}

interface ImportTransactionContext {
  base: ConcurrentImportState;
  state: ConcurrentImportState;
  lockHeld: boolean;
  releaseLock?: () => void;
}

class ConcurrentImportClient implements DatabaseClient {
  private state: ConcurrentImportState = {
    rows: {},
    ledger: new Map(),
    sequences: {},
    insertedBusinessRows: 0,
    ledgerInserts: 0,
    migrationMetadata: false,
  };
  private readonly rootBarrierSize: number;
  private readonly onFirstImportLock?: () => void;
  private readonly onBusinessTablesLocked?: () => void;
  private rootBarrierArrivals = 0;
  private releaseRootBarrier: (() => void) | undefined;
  private readonly rootBarrier: Promise<void>;
  private lockTail = Promise.resolve();
  private importLockHolders = 0;
  private businessTablesLocked = false;
  private readonly ordinaryWriterWaiters: Array<() => void> = [];
  importLockRequests = 0;
  businessTableLockRequests = 0;
  targetCountCheckedBeforeBusinessLock = false;
  ordinaryWriterWaited = false;
  ordinaryWriterCompletedDuringImport = false;
  maxImportLockHolders = 0;
  activeRootTransactions = 0;
  maxActiveRootTransactions = 0;
  duplicateIdAttempts = 0;

  constructor(options: {
    rootBarrierSize?: number;
    onFirstImportLock?: () => void;
    onBusinessTablesLocked?: () => void;
  } = {}) {
    this.rootBarrierSize = options.rootBarrierSize ?? 2;
    this.onFirstImportLock = options.onFirstImportLock;
    this.onBusinessTablesLocked = options.onBusinessTablesLocked;
    this.rootBarrier = this.rootBarrierSize <= 1
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
        this.releaseRootBarrier = resolve;
      });
  }

  get completedRuns(): number {
    return this.state.ledger.size;
  }

  get businessImports(): number {
    return this.state.ledgerInserts;
  }

  get insertedBusinessRows(): number {
    return this.state.insertedBusinessRows;
  }

  sequenceFor(table: string): number | undefined {
    return this.state.sequences[table];
  }

  committedMaxId(table: string): number | undefined {
    const ids = [...(this.state.rows[table] ?? [])]
      .filter((value) => /^\d+$/.test(value))
      .map(Number);
    return ids.length === 0 ? undefined : Math.max(...ids);
  }

  async simulateOrdinaryWriter(): Promise<void> {
    if (this.businessTablesLocked) {
      this.ordinaryWriterWaited = true;
      await new Promise<void>((resolve) => this.ordinaryWriterWaiters.push(resolve));
    }
    this.ordinaryWriterCompletedDuringImport = this.activeRootTransactions > 0;
  }

  private cloneState(source: ConcurrentImportState): ConcurrentImportState {
    return {
      rows: Object.fromEntries(
        Object.entries(source.rows).map(([table, ids]) => [table, new Set(ids)]),
      ),
      ledger: new Map(source.ledger),
      sequences: { ...source.sequences },
      insertedBusinessRows: source.insertedBusinessRows,
      ledgerInserts: source.ledgerInserts,
      migrationMetadata: source.migrationMetadata,
    };
  }

  private async waitForRootOverlap(): Promise<void> {
    this.rootBarrierArrivals += 1;
    if (this.rootBarrierArrivals === this.rootBarrierSize) this.releaseRootBarrier?.();
    await this.rootBarrier;
  }

  private async acquireImportLock(): Promise<() => void> {
    const previousHolder = this.lockTail;
    let release = (): void => {};
    this.lockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previousHolder;
    return release;
  }

  private mergeUnlockedTransaction(context: ImportTransactionContext): void {
    const merged = this.cloneState(this.state);
    for (const [table, transactionRows] of Object.entries(context.state.rows)) {
      const baseRows = context.base.rows[table] ?? new Set<string>();
      const committedRows = merged.rows[table] ?? new Set<string>();
      for (const id of transactionRows) {
        if (baseRows.has(id)) continue;
        if (committedRows.has(id)) {
          this.duplicateIdAttempts += 1;
          throw new Error(`duplicate key for ${table}`);
        }
        committedRows.add(id);
      }
      merged.rows[table] = committedRows;
    }
    for (const [fingerprint, report] of context.state.ledger) {
      if (context.base.ledger.has(fingerprint)) continue;
      if (merged.ledger.has(fingerprint)) throw new Error('duplicate source fingerprint');
      merged.ledger.set(fingerprint, report);
    }
    Object.assign(merged.sequences, context.state.sequences);
    merged.insertedBusinessRows += context.state.insertedBusinessRows
      - context.base.insertedBusinessRows;
    merged.ledgerInserts += context.state.ledgerInserts - context.base.ledgerInserts;
    merged.migrationMetadata ||= context.state.migrationMetadata;
    this.state = merged;
  }

  private createScopedClient(context: ImportTransactionContext): DatabaseClient {
    return {
      query: <ResultRow extends Row>(text: string, params: readonly unknown[] = []) =>
        this.executeQuery<ResultRow>(context, text, params),
      transaction: async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> => {
        const beforeSavepoint = context.state;
        context.state = this.cloneState(beforeSavepoint);
        try {
          return await work(this.createScopedClient(context));
        } catch (error) {
          context.state = beforeSavepoint;
          throw error;
        }
      },
      healthCheck: async () => {},
      close: async () => {},
    };
  }

  private async executeQuery<ResultRow extends Row>(
    context: ImportTransactionContext | null,
    text: string,
    params: readonly unknown[],
  ): Promise<QueryResult<ResultRow>> {
    if (/pg_advisory_xact_lock/i.test(text)) {
      if (!context || !/^\s*SELECT\s+pg_advisory_xact_lock\(49375484\)\s*;?\s*$/i.test(text)) {
        throw new Error('Unexpected SQLite import advisory lock query.');
      }
      this.importLockRequests += 1;
      context.releaseLock = await this.acquireImportLock();
      context.lockHeld = true;
      this.importLockHolders += 1;
      this.maxImportLockHolders = Math.max(this.maxImportLockHolders, this.importLockHolders);
      context.base = this.cloneState(this.state);
      context.state = this.cloneState(this.state);
      if (this.importLockRequests === 1) this.onFirstImportLock?.();
      return { rows: [], rowCount: 1 };
    }

    if (/^\s*SET\s+LOCAL\s+lock_timeout/i.test(text)) {
      if (!context?.lockHeld) throw new Error('lock_timeout must be set inside the import transaction.');
      return { rows: [], rowCount: 0 };
    }
    if (/^\s*LOCK\s+TABLE/i.test(text)) {
      if (!context?.lockHeld || !/ACCESS\s+EXCLUSIVE\s+MODE/i.test(text)) {
        throw new Error('Business tables require an in-transaction ACCESS EXCLUSIVE lock.');
      }
      const actualTables = [...text.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
      const expectedTables = MIGRATION_TABLES.map(({ name }) => name).sort();
      assert.deepEqual(actualTables, expectedTables);
      this.businessTableLockRequests += 1;
      this.businessTablesLocked = true;
      this.onBusinessTablesLocked?.();
      return { rows: [], rowCount: 0 };
    }

    const state = context?.state ?? this.state;
    if (/to_regclass\('schema_migrations'\)/i.test(text)) {
      return {
        rows: [{ relation_name: state.migrationMetadata ? 'schema_migrations' : null }] as unknown as ResultRow[],
        rowCount: 1,
      };
    }
    if (/TEST_CREATE_MIGRATION_METADATA/i.test(text)) {
      state.migrationMetadata = true;
      return { rows: [], rowCount: 0 };
    }
    if (/SELECT\s+import_id,\s*report_json\s+FROM\s+sqlite_import_runs/i.test(text)) {
      const report = state.ledger.get(String(params[0]));
      return {
        rows: report ? [{ import_id: report.importId, report_json: report }] as unknown as ResultRow[] : [],
        rowCount: report ? 1 : 0,
      };
    }
    if (/INSERT\s+INTO\s+sqlite_import_runs/i.test(text)) {
      const fingerprint = String(params[1]);
      if (state.ledger.has(fingerprint)) throw new Error('duplicate source fingerprint');
      state.ledger.set(fingerprint, JSON.parse(String(params[8])) as DatabaseImportReport);
      state.ledgerInserts += 1;
      return { rows: [], rowCount: 1 };
    }
    if (/SELECT\s+version\s+FROM\s+schema_migrations/i.test(text)) {
      return {
        rows: [1, 2, 3].map((version) => ({ version })) as unknown as ResultRow[],
        rowCount: 3,
      };
    }
    const countTable = /SELECT count\(\*\)::text AS count FROM "([a-z_]+)"/i.exec(text)?.[1];
    if (countTable) {
      if (!this.businessTablesLocked) this.targetCountCheckedBeforeBusinessLock = true;
      const count = state.rows[countTable]?.size ?? 0;
      return { rows: [{ count: String(count) }] as unknown as ResultRow[], rowCount: 1 };
    }
    const insertTable = /^INSERT INTO "([a-z_]+)"/i.exec(text)?.[1];
    if (insertTable) {
      const id = String(params[0]);
      const ids = state.rows[insertTable] ?? new Set<string>();
      if (ids.has(id)) throw new Error(`duplicate key for ${insertTable}`);
      ids.add(id);
      state.rows[insertTable] = ids;
      state.insertedBusinessRows += 1;
      return { rows: [], rowCount: 1 };
    }
    if (/SELECT\s+setval\(pg_get_serial_sequence/i.test(text)) {
      const table = String(params[0]);
      const ids = [...(state.rows[table] ?? [])]
        .filter((value) => /^\d+$/.test(value))
        .map(Number);
      state.sequences[table] = ids.length === 0 ? 1 : Math.max(...ids);
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    return this.executeQuery<ResultRow>(null, text, params);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    this.activeRootTransactions += 1;
    this.maxActiveRootTransactions = Math.max(
      this.maxActiveRootTransactions,
      this.activeRootTransactions,
    );
    await this.waitForRootOverlap();
    const context: ImportTransactionContext = {
      base: this.cloneState(this.state),
      state: this.cloneState(this.state),
      lockHeld: false,
    };
    try {
      const result = await work(this.createScopedClient(context));
      if (context.lockHeld) this.state = this.cloneState(context.state);
      else this.mergeUnlockedTransaction(context);
      return result;
    } finally {
      if (context.lockHeld) {
        this.importLockHolders -= 1;
        context.releaseLock?.();
      }
      this.activeRootTransactions -= 1;
      if (this.businessTablesLocked) {
        this.businessTablesLocked = false;
        for (const release of this.ordinaryWriterWaiters.splice(0)) release();
      }
    }
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

function migrateWithTestDependencies(
  client: DatabaseClient,
  sourcePath: string,
  backupDirectory: string,
): Promise<DatabaseImportReport> {
  return migrateSqliteDatabase({
    sourcePath,
    client,
    backupDirectory,
    runMigrations: async () => ({ appliedVersions: [1, 2, 3] }),
    validateTargetSchema: async () => {},
    verifyMigration: async ({ sourcePath: verificationSource }) => {
      const summary = readSqliteSnapshot(verificationSource).summary;
      return buildMigrationVerification(summary, structuredClone(summary), {});
    },
  });
}

test('concurrent different-source imports serialize at the dedicated advisory lock', async (t) => {
  const firstSource = createFixture(t);
  const secondSource = createDisjointFixture(t);
  const client = new ConcurrentImportClient();
  const directory = temporaryDirectory(t);

  const results = await Promise.allSettled([
    migrateWithTestDependencies(client, firstSource, path.join(directory, 'first-backups')),
    migrateWithTestDependencies(client, secondSource, path.join(directory, 'second-backups')),
  ]);

  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(results.filter(({ status }) => status === 'rejected').length, 1);
  assert.equal(client.maxActiveRootTransactions, 2);
  assert.equal(client.importLockRequests, 2);
  assert.equal(client.maxImportLockHolders, 1);
  assert.equal(client.businessImports, 1);
  assert.equal(client.completedRuns, 1);
  assert.equal(client.duplicateIdAttempts, 0);
  assert.equal(client.sequenceFor('users'), client.committedMaxId('users'));
});

test('concurrent same-source imports return one import and one completed-ledger no-op', async (t) => {
  const sourcePath = createFixture(t);
  const client = new ConcurrentImportClient();
  const directory = temporaryDirectory(t);

  const reports = await Promise.all([
    migrateWithTestDependencies(client, sourcePath, path.join(directory, 'first-backups')),
    migrateWithTestDependencies(client, sourcePath, path.join(directory, 'second-backups')),
  ]);

  assert.equal(reports[0].importId, reports[1].importId);
  assert.equal(client.maxActiveRootTransactions, 2);
  assert.equal(client.importLockRequests, 2);
  assert.equal(client.maxImportLockHolders, 1);
  assert.equal(client.businessImports, 1);
  assert.equal(client.completedRuns, 1);
  assert.equal(client.duplicateIdAttempts, 0);
  assert.equal(client.sequenceFor('users'), client.committedMaxId('users'));
});

test('same-source recovery remains a no-op when the second runner starts after schema creation', async (t) => {
  const sourcePath = createFixture(t);
  const client = new ConcurrentImportClient({ rootBarrierSize: 1 });
  const directory = temporaryDirectory(t);
  let releaseFirstValidation = (): void => {};
  let announceFirstValidation = (): void => {};
  const firstValidationStarted = new Promise<void>((resolve) => {
    announceFirstValidation = resolve;
  });
  const firstValidationGate = new Promise<void>((resolve) => {
    releaseFirstValidation = resolve;
  });
  const migrationDependencies = {
    runMigrations: async (migrationClient: DatabaseClient) => {
      await migrationClient.query('SELECT TEST_CREATE_MIGRATION_METADATA');
      return { appliedVersions: [1, 2, 3] };
    },
    verifyMigration: async ({ sourcePath: verificationSource }: { sourcePath: string }) => {
      const summary = readSqliteSnapshot(verificationSource).summary;
      return buildMigrationVerification(summary, structuredClone(summary), {});
    },
  };

  const first = migrateSqliteDatabase({
    sourcePath,
    client,
    backupDirectory: path.join(directory, 'first-backups'),
    ...migrationDependencies,
    validateTargetSchema: async () => {
      announceFirstValidation();
      await firstValidationGate;
    },
  });
  await firstValidationStarted;
  const second = migrateSqliteDatabase({
    sourcePath,
    client,
    backupDirectory: path.join(directory, 'second-backups'),
    ...migrationDependencies,
    validateTargetSchema: async () => {},
  });
  const reportsPromise = Promise.all([first, second]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  releaseFirstValidation();

  const reports = await reportsPromise;
  assert.equal(reports[0].importId, reports[1].importId);
  assert.equal(client.businessImports, 1);
  assert.equal(client.completedRuns, 1);
  assert.equal(client.importLockRequests, 2);
});

test('locked import decision rechecks the source manifest before writing business rows', async (t) => {
  const sourcePath = createFixture(t);
  const client = new ConcurrentImportClient({
    rootBarrierSize: 1,
    onFirstImportLock: () => {
      const database = new DatabaseSync(sourcePath);
      database.exec('CREATE TABLE unexpected_data (id INTEGER PRIMARY KEY); INSERT INTO unexpected_data VALUES (1)');
      database.close();
    },
  });

  await assert.rejects(
    () => migrateWithTestDependencies(client, sourcePath, path.join(temporaryDirectory(t), 'backups')),
    /manual mapping|not in the migration manifest/i,
  );
  assert.equal(client.importLockRequests, 1);
  assert.equal(client.insertedBusinessRows, 0);
  assert.equal(client.completedRuns, 0);
});

test('import fails with retry guidance when the source changes during backup creation', async (t) => {
  const sourcePath = createFixture(t);
  const client = new ConcurrentImportClient({ rootBarrierSize: 1 });
  const backupDirectory = path.join(temporaryDirectory(t), 'backups');

  await assert.rejects(
    () => migrateSqliteDatabase({
      sourcePath,
      client,
      backupDirectory,
      runMigrations: async () => ({ appliedVersions: [1, 2, 3] }),
      validateTargetSchema: async () => {},
      prepareSource: (pathToSource, options) => {
        const prepared = prepareSqliteSource(pathToSource, options);
        const database = new DatabaseSync(pathToSource);
        database.exec("UPDATE users SET name = '备份期间变更' WHERE id = 7");
        database.close();
        return prepared;
      },
      verifyMigration: async ({ sourcePath: verificationSource }) => {
        const summary = readSqliteSnapshot(verificationSource).summary;
        return buildMigrationVerification(summary, structuredClone(summary), {});
      },
    }),
    /source changed.*retry/i,
  );
  assert.equal(client.insertedBusinessRows, 0);
  assert.equal(client.completedRuns, 0);
});

test('business table locks block an ordinary writer until the import transaction commits', async (t) => {
  const sourcePath = createFixture(t);
  let writer: Promise<void> | undefined;
  const client = new ConcurrentImportClient({
    rootBarrierSize: 1,
    onBusinessTablesLocked: () => {
      writer = client.simulateOrdinaryWriter();
    },
  });

  await migrateWithTestDependencies(client, sourcePath, path.join(temporaryDirectory(t), 'backups'));
  await writer;
  assert.equal(client.businessTableLockRequests, 1);
  assert.equal(client.targetCountCheckedBeforeBusinessLock, false);
  assert.equal(client.ordinaryWriterWaited, true);
  assert.equal(client.ordinaryWriterCompletedDuringImport, false);
});

const integrationOptions = process.env.TEST_DATABASE_URL
  ? {}
  : { skip: POSTGRES_TEST_SKIP_REASON };

test('PostgreSQL: business table locks block an ordinary writer during cutover', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);
  const writerClient = harness.createAdditionalClient();
  const sourcePath = createFixture(t);
  const backupDirectory = path.join(temporaryDirectory(t), 'backups');
  let signalLocked: (() => void) | undefined;
  const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
  let releaseLocks: (() => void) | undefined;
  const release = new Promise<void>((resolve) => { releaseLocks = resolve; });

  const migration = migrateSqliteDatabase({
    sourcePath,
    client: harness.client,
    backupDirectory,
    afterBusinessTablesLocked: async () => {
      signalLocked?.();
      await release;
    },
  });
  await locked;
  try {
    await assert.rejects(
      () => writerClient.transaction(async (client) => {
        await client.query("SET LOCAL lock_timeout = '100ms'");
        await client.query(
          "INSERT INTO users (username, password_hash) VALUES ('blocked-writer', 'safe-hash')",
        );
      }),
      /lock timeout|canceling statement/i,
    );
  } finally {
    releaseLocks?.();
  }
  const report = await migration;
  assert.equal(report.success, true);
});

test('PostgreSQL: concurrent different-source imports serialize and only one writes', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);
  const secondClient = harness.createAdditionalClient();
  const firstSource = createFixture(t);
  const secondSource = createDisjointFixture(t);
  const directory = temporaryDirectory(t);

  const results = await Promise.allSettled([
    migrateSqliteDatabase({
      sourcePath: firstSource,
      client: harness.client,
      backupDirectory: path.join(directory, 'first-backups'),
    }),
    migrateSqliteDatabase({
      sourcePath: secondSource,
      client: secondClient,
      backupDirectory: path.join(directory, 'second-backups'),
    }),
  ]);

  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  assert.match(String(rejected?.reason), /business rows/i);
  const counts = await harness.client.query<{ users: string; runs: string }>(`
    SELECT
      (SELECT count(*)::text FROM users) AS users,
      (SELECT count(*)::text FROM sqlite_import_runs) AS runs
  `);
  assert.deepEqual(counts.rows[0], { users: '2', runs: '1' });
  const maximum = await harness.client.query<{ id: string }>('SELECT max(id)::text AS id FROM users');
  const generated = await harness.client.query<{ id: string }>(
    "INSERT INTO users (username, password_hash) VALUES ('concurrent-next', 'safe-hash') RETURNING id::text",
  );
  assert.equal(Number(generated.rows[0].id), Number(maximum.rows[0].id) + 1);
});

test('PostgreSQL: concurrent same-source imports return the completed ledger without duplicates', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);
  const secondClient = harness.createAdditionalClient();
  const sourcePath = createFixture(t);
  const directory = temporaryDirectory(t);

  const reports = await Promise.all([
    migrateSqliteDatabase({
      sourcePath,
      client: harness.client,
      backupDirectory: path.join(directory, 'first-backups'),
    }),
    migrateSqliteDatabase({
      sourcePath,
      client: secondClient,
      backupDirectory: path.join(directory, 'second-backups'),
    }),
  ]);

  assert.equal(reports[0].importId, reports[1].importId);
  const counts = await harness.client.query<{ users: string; runs: string }>(`
    SELECT
      (SELECT count(*)::text FROM users) AS users,
      (SELECT count(*)::text FROM sqlite_import_runs) AS runs
  `);
  assert.deepEqual(counts.rows[0], { users: '2', runs: '1' });
  const maximum = await harness.client.query<{ id: string }>('SELECT max(id)::text AS id FROM users');
  const generated = await harness.client.query<{ id: string }>(
    "INSERT INTO users (username, password_hash) VALUES ('same-source-next', 'safe-hash') RETURNING id::text",
  );
  assert.equal(Number(generated.rows[0].id), Number(maximum.rows[0].id) + 1);
});

test('PostgreSQL: imports exact fixture values and resets generated IDs', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);
  await runPostgresMigrations(harness.client);
  const sourcePath = createFixture(t);
  const snapshot: MigrationSnapshot = readSqliteSnapshot(sourcePath);
  await importSqliteSnapshot(harness.client, snapshot);
  const verification = await verifyDatabaseMigration({ sourcePath, client: harness.client });
  assert.equal(verification.success, true);

  const users = await harness.client.query<{
    id: string;
    username: string;
    password_hash: string;
    is_active: boolean;
    created_at: Date;
  }>('SELECT id::text, username, password_hash, is_active, created_at FROM users ORDER BY id');
  assert.deepEqual(users.rows.map(({ id, username, password_hash, is_active }) => ({
    id, username, password_hash, is_active,
  })), [
    { id: '7', username: 'admin', password_hash: '$2b$admin-hash', is_active: true },
    { id: '11', username: 'member', password_hash: '$2b$member-hash', is_active: false },
  ]);
  assert.equal(users.rows[0].created_at.toISOString(), '2026-08-01T09:10:11.123Z');

  const quote = await harness.client.query<{
    id: string;
    client_id: string;
    total: string;
    created_by: string;
  }>('SELECT id::text, client_id::text, total::text, created_by FROM engineering_quotes');
  assert.deepEqual(quote.rows[0], { id: '13', client_id: '4', total: '113.11', created_by: 'admin' });
  const session = await harness.client.query<{ token_hash: string; user_id: string }>(
    'SELECT token_hash, user_id::text FROM auth_sessions',
  );
  assert.deepEqual(session.rows[0], { token_hash: 'sha256:token-hash', user_id: '7' });

  const maintenance = await harness.client.query<{
    id: string;
    client_id: string;
    total: string;
    created_by: string;
  }>('SELECT id::text, client_id::text, total::text, created_by FROM maintenance_quotes');
  assert.deepEqual(maintenance.rows[0], {
    id: '17', client_id: '4', total: '226.23', created_by: 'member',
  });
  const workflow = await harness.client.query<{
    version_id: string;
    share_id: string;
    audit_id: string;
    session_id: string;
    log_id: string;
    config_id: string;
  }>(`
    SELECT
      (SELECT id::text FROM quote_versions) AS version_id,
      (SELECT id::text FROM quote_shares) AS share_id,
      (SELECT id::text FROM quote_audit_logs) AS audit_id,
      (SELECT id::text FROM agent_sessions) AS session_id,
      (SELECT id::text FROM agent_logs) AS log_id,
      (SELECT id::text FROM agent_configs) AS config_id
  `);
  assert.deepEqual(workflow.rows[0], {
    version_id: '19', share_id: '23', audit_id: '29',
    session_id: '41', log_id: '43', config_id: '37',
  });
  const reference = await harness.client.query<{ id: string; unit_price: string }>(
    'SELECT id::text, unit_price::text FROM labor_price_config',
  );
  assert.deepEqual(reference.rows[0], { id: '31', unit_price: '888.88' });

  const generated = await harness.client.query<{ id: string }>(
    "INSERT INTO users (username, password_hash) VALUES ('next-user', 'next-hash') RETURNING id::text",
  );
  assert.equal(generated.rows[0].id, '12');
});
