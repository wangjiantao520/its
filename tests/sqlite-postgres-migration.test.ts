import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
  assertTargetReadyForImport,
  buildMigrationVerification,
  importSqliteSnapshot,
  prepareSqliteSource,
  readSqliteSnapshot,
  transformSqliteValue,
  verifyDatabaseMigration,
  writeJsonReportAtomic,
  type MigrationSnapshot,
} from '../scripts/database/sqlite-postgres-migration';
import {
  createPostgresTestHarness,
  POSTGRES_TEST_SKIP_REASON,
} from './helpers/postgres';
import {
  buildCanonicalPostgresManifest,
  serializableManifest,
} from './helpers/postgres-schema';

type Row = Record<string, unknown>;

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
  assert.equal(transformSqliteValue('engineering_quotes', 'total', 113.1), '113.10');
  assert.equal(transformSqliteValue('engineering_quotes', 'items', '[{"id":1}]'), '[{"id":1}]');
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
  assert.deepEqual(
    success.aggregates.engineering_quotes.source,
    source.aggregates.engineering_quotes,
  );
  assert.deepEqual(success.identities.users, { sequenceValue: '11', maxId: '11', safe: true });

  matching.tables.users.count = 1;
  matching.users[0].username = 'changed-admin';
  matching.users[0].passwordHashMatches = false;
  const mismatch = buildMigrationVerification(source, matching, {});
  assert.equal(mismatch.success, false);
  assert.equal(mismatch.users[0].usernameMatches, false);
  const serialized = JSON.stringify(mismatch);
  assert.equal(serialized.includes('$2b$admin-hash'), false);
  assert.equal(serialized.includes('sha256:token-hash'), false);
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
  assert.match(importHelp.stdout, /--source[\s\S]*--target[\s\S]*--report/);
  assert.match(importHelp.stdout, /--allow-nonempty-target/);

  const verifyHelp = spawnSync('pnpm', ['db:verify-migration', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(verifyHelp.status, 0, verifyHelp.stderr);
  assert.match(verifyHelp.stdout, /--source[\s\S]*--target[\s\S]*--report/);

  const username = 'migration_user_secret';
  const password = 'migration_password_secret';
  const target = `postgres://${username}:${password}@[invalid-host`;
  const failed = spawnSync(
    'pnpm',
    ['db:import-sqlite', '--source', '/missing/source.db', '--target', target, '--report', '/tmp/unused-report.json'],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  const output = `${failed.stdout}${failed.stderr}`;
  assert.notEqual(failed.status, 0);
  for (const secret of [target, username, password]) assert.equal(output.includes(secret), false);
});

const integrationOptions = process.env.TEST_DATABASE_URL
  ? {}
  : { skip: POSTGRES_TEST_SKIP_REASON };

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
