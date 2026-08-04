import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import {
  loadPostgresMigrations,
  runPostgresMigrations,
  type PostgresMigration,
} from '../src/lib/database/postgres-migrations';
import {
  createPostgresTestHarness,
  POSTGRES_TEST_SKIP_REASON,
} from './helpers/postgres';

type Row = Record<string, unknown>;

const ADVISORY_LOCK_QUERY = 'SELECT pg_advisory_xact_lock(49375483)';

interface RecordingMigrationClientOptions {
  transactionBarrierSize?: number;
  queryFailure?: (text: string) => unknown | undefined;
}

interface RecordingTransaction {
  id: number;
  stagedVersions: Map<number, string>;
  holdsAdvisoryLock: boolean;
}

class RecordingMigrationClient implements DatabaseClient {
  readonly queries: Array<{ text: string; params: readonly unknown[]; transactionId?: number }> = [];
  readonly versions = new Map<number, string>();
  readonly transactionStartOrder: number[] = [];
  readonly lockRequestOrder: number[] = [];
  readonly lockAcquisitionOrder: number[] = [];
  readonly activeTransactionsAtLockRequest: number[] = [];
  readonly migrationExecutionCounts = new Map<string, number>();
  transactionCount = 0;
  maxConcurrentTransactions = 0;
  maxConcurrentLockHolders = 0;
  private activeTransactions = 0;
  private concurrentLockHolders = 0;
  private lockOwner: number | undefined;
  private readonly lockWaiters: Array<{ transactionId: number; resolve: () => void }> = [];
  private readonly transactionBarrierSize: number;
  private readonly transactionBarrier: Promise<void> | undefined;
  private releaseTransactionBarrier: (() => void) | undefined;
  private transactionBarrierArrivals = 0;
  private readonly queryFailure: ((text: string) => unknown | undefined) | undefined;

  constructor(options: RecordingMigrationClientOptions = {}) {
    this.transactionBarrierSize = options.transactionBarrierSize ?? 1;
    this.queryFailure = options.queryFailure;
    if (this.transactionBarrierSize > 1) {
      this.transactionBarrier = new Promise<void>((resolve) => {
        this.releaseTransactionBarrier = resolve;
      });
    }
  }

  async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    return this.executeQuery<ResultRow>(undefined, text, params);
  }

  private async executeQuery<ResultRow extends Row>(
    transaction: RecordingTransaction | undefined,
    text: string,
    params: readonly unknown[],
  ): Promise<QueryResult<ResultRow>> {
    this.queries.push({ text, params, transactionId: transaction?.id });
    if (text.trim() === ADVISORY_LOCK_QUERY && transaction) {
      await this.acquireAdvisoryLock(transaction);
      return { rows: [], rowCount: 1 };
    }

    const failure = this.queryFailure?.(text);
    if (failure !== undefined) throw failure;

    if (/SELECT\s+version\s+FROM\s+schema_migrations/i.test(text)) {
      return {
        rows: [...this.versions.keys()].sort((a, b) => a - b).map((version) => ({ version })) as unknown as ResultRow[],
        rowCount: this.versions.size,
      };
    }
    if (/INSERT\s+INTO\s+schema_migrations/i.test(text)) {
      const [version, name] = params;
      if (typeof version !== 'number' || typeof name !== 'string') {
        throw new Error('invalid migration record parameters');
      }
      if (this.versions.has(version) || transaction?.stagedVersions.has(version)) {
        throw Object.assign(new Error('duplicate migration version'), { code: '23505' });
      }
      if (transaction) transaction.stagedVersions.set(version, name);
      else this.versions.set(version, name);
      return { rows: [], rowCount: 1 };
    }

    if (!/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+schema_migrations/i.test(text)) {
      this.migrationExecutionCounts.set(
        text,
        (this.migrationExecutionCounts.get(text) ?? 0) + 1,
      );
    }
    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const transaction: RecordingTransaction = {
      id: ++this.transactionCount,
      stagedVersions: new Map(),
      holdsAdvisoryLock: false,
    };
    this.transactionStartOrder.push(transaction.id);
    this.activeTransactions += 1;
    this.maxConcurrentTransactions = Math.max(
      this.maxConcurrentTransactions,
      this.activeTransactions,
    );

    await this.waitForTransactionBarrier();
    const transactionClient: DatabaseClient = {
      query: <ResultRow extends Row>(text: string, params: readonly unknown[] = []) =>
        this.executeQuery<ResultRow>(transaction, text, params),
      transaction: async () => {
        throw new Error('nested transactions are not supported by this recording client');
      },
      healthCheck: async (): Promise<void> => {},
      close: async (): Promise<void> => {},
    };

    try {
      const result = await work(transactionClient);
      for (const [version, name] of transaction.stagedVersions) {
        if (this.versions.has(version)) {
          throw Object.assign(new Error('duplicate migration version'), { code: '23505' });
        }
        this.versions.set(version, name);
      }
      return result;
    } finally {
      if (transaction.holdsAdvisoryLock) this.releaseAdvisoryLock(transaction.id);
      this.activeTransactions -= 1;
    }
  }

  private async waitForTransactionBarrier(): Promise<void> {
    if (!this.transactionBarrier) return;
    this.transactionBarrierArrivals += 1;
    if (this.transactionBarrierArrivals === this.transactionBarrierSize) {
      this.releaseTransactionBarrier?.();
    }
    await this.transactionBarrier;
  }

  private async acquireAdvisoryLock(transaction: RecordingTransaction): Promise<void> {
    this.lockRequestOrder.push(transaction.id);
    this.activeTransactionsAtLockRequest.push(this.activeTransactions);
    if (this.lockOwner === undefined) {
      this.lockOwner = transaction.id;
    } else {
      await new Promise<void>((resolve) => {
        this.lockWaiters.push({ transactionId: transaction.id, resolve });
      });
    }

    transaction.holdsAdvisoryLock = true;
    this.concurrentLockHolders += 1;
    this.maxConcurrentLockHolders = Math.max(
      this.maxConcurrentLockHolders,
      this.concurrentLockHolders,
    );
    this.lockAcquisitionOrder.push(transaction.id);
  }

  private releaseAdvisoryLock(transactionId: number): void {
    assert.equal(this.lockOwner, transactionId);
    this.concurrentLockHolders -= 1;
    const next = this.lockWaiters.shift();
    if (next) {
      this.lockOwner = next.transactionId;
      next.resolve();
    } else {
      this.lockOwner = undefined;
    }
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

test('loads numbered SQL migrations in numeric order with canonical schema semantics', () => {
  const migrations = loadPostgresMigrations();

  assert.deepEqual(migrations.map(({ version }) => version), [1, 2]);
  assert.deepEqual(
    migrations.map(({ name }) => name),
    ['001_initial_schema.sql', '002_indexes_and_constraints.sql'],
  );
  assert.match(migrations[0]?.sql ?? '', /CREATE TABLE IF NOT EXISTS users/i);
  assert.match(migrations[0]?.sql ?? '', /password_hash text NOT NULL/i);
  assert.match(migrations[0]?.sql ?? '', /token_hash text PRIMARY KEY/i);
  assert.match(migrations[0]?.sql ?? '', /model text DEFAULT 'default'/i);
  assert.match(migrations[0]?.sql ?? '', /numeric\(18,2\)/i);
  assert.match(migrations[0]?.sql ?? '', /jsonb/i);
  for (const legacyCurrentColumn of [
    'annual_failure_count',
    'year_fault_rate',
    'note',
    'quote_type',
    'maintenance_rate',
    'sla_level',
    'resolution_time',
    'penalty_rate',
    'device_config',
    'usage_count',
  ]) {
    assert.match(migrations[0]?.sql ?? '', new RegExp(`\\b${legacyCurrentColumn}\\b`, 'i'));
  }
  assert.doesNotMatch(migrations[0]?.sql ?? '', /\bINSERT\s+INTO\b/i);
  assert.match(migrations[1]?.sql ?? '', /CREATE (?:UNIQUE )?INDEX/i);
  assert.match(migrations[1]?.sql ?? '', /END;\s*\$security\$/i);
});

test('loads copied SQL assets when only the production dist layout is available', () => {
  const temporaryProject = fs.mkdtempSync(path.join(os.tmpdir(), 'its-migrations-'));
  const distSql = path.join(temporaryProject, 'dist/database/sql');
  fs.mkdirSync(distSql, { recursive: true });
  for (const fileName of ['001_initial_schema.sql', '002_indexes_and_constraints.sql']) {
    fs.copyFileSync(path.join('src/lib/database/sql', fileName), path.join(distSql, fileName));
  }

  const originalWorkingDirectory = process.cwd();
  try {
    process.chdir(temporaryProject);
    assert.deepEqual(loadPostgresMigrations().map(({ version }) => version), [1, 2]);
  } finally {
    process.chdir(originalWorkingDirectory);
    fs.rmSync(temporaryProject, { recursive: true, force: true });
  }
});

test('production build copies PostgreSQL migration assets beside the server bundle', () => {
  const buildScript = fs.readFileSync('scripts/build.sh', 'utf8');

  assert.match(
    buildScript,
    /cp\s+-R\s+src\/lib\/database\/sql\s+dist\/database\/sql/,
  );
});

test('migration CLI never prints credentials from a malformed database URL', () => {
  const username = 'leak_probe_user_7f1b';
  const password = 'leak_probe_password_93ac';
  const malformedUrl = `postgres://${username}:${password}@[invalid-host`;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/migrate-db.mts'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_MIGRATION_URL: malformedUrl,
        DATABASE_URL: '',
      },
    },
  );
  const output = `${result.stdout}${result.stderr}`;

  assert.notEqual(result.status, 0);
  assert.match(output, /Database migration failed\./);
  for (const sensitiveValue of [malformedUrl, username, password]) {
    assert.equal(output.includes(sensitiveValue), false, `leaked ${sensitiveValue}`);
  }
  assert.doesNotMatch(output, /ERR_INVALID_URL|\binput\b/i);
});

test('applies each migration exactly once and acquires the required transaction lock', async () => {
  const client = new RecordingMigrationClient();

  assert.deepEqual(await runPostgresMigrations(client), { appliedVersions: [1, 2] });
  assert.deepEqual(await runPostgresMigrations(client), { appliedVersions: [] });
  assert.equal(client.transactionCount, 2);
  assert.equal(
    client.queries.filter(({ text }) => /pg_advisory_xact_lock\(49375483\)/i.test(text)).length,
    2,
  );
  assert.deepEqual([...client.versions.keys()], [1, 2]);
});

test('concurrent migration calls serialize safely', async () => {
  const client = new RecordingMigrationClient({ transactionBarrierSize: 2 });
  const migrations = loadPostgresMigrations();

  const results = await Promise.all([
    runPostgresMigrations(client),
    runPostgresMigrations(client),
  ]);

  assert.deepEqual(results, [
    { appliedVersions: [1, 2] },
    { appliedVersions: [] },
  ]);
  assert.deepEqual(client.transactionStartOrder, [1, 2]);
  assert.equal(client.maxConcurrentTransactions, 2);
  assert.deepEqual(client.lockRequestOrder, [1, 2]);
  assert.deepEqual(client.lockAcquisitionOrder, [1, 2]);
  assert.deepEqual(client.activeTransactionsAtLockRequest, [2, 2]);
  assert.equal(client.maxConcurrentLockHolders, 1);
  for (const migration of migrations) {
    assert.equal(client.migrationExecutionCounts.get(migration.sql), 1);
  }
  assert.deepEqual([...client.versions.keys()], [1, 2]);
});

test('a failed migration rolls back its version record and does not continue', async () => {
  const client = new RecordingMigrationClient({
    queryFailure: (text) => text === 'FAIL THIS MIGRATION'
      ? new Error('synthetic migration failure')
      : undefined,
  });
  const migrations: PostgresMigration[] = [
    { version: 9, name: 'works', sql: 'CREATE TABLE works (id bigint)' },
    { version: 10, name: 'fails', sql: 'FAIL THIS MIGRATION' },
    { version: 11, name: 'must-not-run', sql: 'CREATE TABLE must_not_run (id bigint)' },
  ];
  await assert.rejects(
    () => runPostgresMigrations(client, { migrations }),
    /PostgreSQL migration failed/,
  );
  assert.deepEqual([...client.versions.keys()], []);
  assert.equal(client.queries.some(({ text }) => /must_not_run/i.test(text)), false);
});

test('migration status errors never expose connection credentials', async () => {
  const secret = 'postgres://its_admin:top-secret@db.example.test:5432/its';
  const client = new RecordingMigrationClient({
    queryFailure: (text) => /SELECT\s+version\s+FROM\s+schema_migrations/i.test(text)
      ? new Error(`could not connect to ${secret}`)
      : undefined,
  });

  await assert.rejects(
    () => runPostgresMigrations(client),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /PostgreSQL migration failed/);
      assert.doesNotMatch(error.message, /its_admin|top-secret|db\.example\.test/);
      assert.doesNotMatch(error.stack ?? '', /its_admin|top-secret|db\.example\.test/);
      return true;
    },
  );
});

const integrationOptions = process.env.TEST_DATABASE_URL
  ? {}
  : { skip: POSTGRES_TEST_SKIP_REASON };

test('PostgreSQL: migrations are idempotent and create canonical tables', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);

  assert.deepEqual(await runPostgresMigrations(harness.client), { appliedVersions: [1, 2] });
  assert.deepEqual(await runPostgresMigrations(harness.client), { appliedVersions: [] });

  const tables = await harness.client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
  `);
  const names = new Set(tables.rows.map(({ table_name }) => table_name));
  for (const name of [
    'users',
    'auth_sessions',
    'engineering_quotes',
    'maintenance_quotes',
    'agent_sessions',
  ]) {
    assert.ok(names.has(name), `missing canonical table ${name}`);
  }
});

test('PostgreSQL: concurrent runners apply every migration once', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);
  const secondClient = harness.createAdditionalClient();

  const results = await Promise.all([
    runPostgresMigrations(harness.client),
    runPostgresMigrations(secondClient),
  ]);

  assert.deepEqual(results.flatMap(({ appliedVersions }) => appliedVersions).sort(), [1, 2]);
  const versions = await harness.client.query<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  assert.deepEqual(versions.rows.map(({ version }) => version), [1, 2]);
});

test('PostgreSQL: failed migration rolls back DDL, DML, and version row', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);
  await runPostgresMigrations(harness.client);
  const migrations: PostgresMigration[] = [{
    version: 99,
    name: 'transactional-failure',
    sql: `
      CREATE TABLE rollback_probe (id bigint PRIMARY KEY, value text NOT NULL);
      INSERT INTO rollback_probe (id, value) VALUES (1, 'before failure');
      SELECT definitely_missing_function();
    `,
  }];

  await assert.rejects(() => runPostgresMigrations(harness.client, { migrations }));
  const table = await harness.client.query<{ regclass: string | null }>(
    "SELECT to_regclass('rollback_probe')::text AS regclass",
  );
  assert.equal(table.rows[0]?.regclass, null);
  const version = await harness.client.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM schema_migrations WHERE version = 99',
  );
  assert.equal(version.rows[0]?.count, '0');
});
