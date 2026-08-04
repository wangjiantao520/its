import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { DatabaseUnavailableError } from '../src/lib/database/errors';
import {
  loadPostgresMigrations,
  PostgresMigrationError,
  runPostgresMigrations,
  type PostgresMigration,
} from '../src/lib/database/postgres-migrations';
import {
  createPostgresTestHarness,
  POSTGRES_TEST_SKIP_REASON,
} from './helpers/postgres';
import {
  buildCanonicalPostgresManifest,
  definitionsToManifest,
  extractRouteSqlAudit,
  parsePostgresColumnDefinitions,
  serializableManifest,
} from './helpers/postgres-schema';

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

function readTargetSchemaSql(): string {
  return fs.readFileSync('src/lib/database/sql/001_initial_schema.sql', 'utf8');
}

test('loads exactly the strictly named source migration assets in numeric order', () => {
  const migrations = loadPostgresMigrations();
  const sourceFiles = fs.readdirSync('src/lib/database/sql')
    .filter((fileName) => /^\d{3}_[a-z0-9_]+\.sql$/.test(fileName))
    .sort();

  assert.deepEqual(migrations.map(({ version }) => version), [1, 2, 3]);
  assert.deepEqual(migrations.map(({ name }) => name), sourceFiles);
  assert.deepEqual(sourceFiles, [
    '001_initial_schema.sql',
    '002_indexes_and_constraints.sql',
    '003_sqlite_import_runs.sql',
  ]);
});

test('target schema exactly matches canonical definitions and route write compatibility', () => {
  const expected = buildCanonicalPostgresManifest();
  const definitions = parsePostgresColumnDefinitions(readTargetSchemaSql());
  const actual = definitionsToManifest(definitions);
  const routeAudit = extractRouteSqlAudit();

  assert.deepEqual(serializableManifest(actual), serializableManifest(expected));
  assert.equal(actual.size, 27);
  assert.equal([...actual.values()].reduce((total, columns) => total + columns.size, 0), 404);
  assert.deepEqual(
    [...routeAudit.referencedTables].filter((table) => !actual.has(table)).sort(),
    [],
  );
  assert.deepEqual(
    [...routeAudit.writeColumns].flatMap(([table, columns]) =>
      [...columns].filter((column) => !actual.get(table)?.has(column)).map((column) => `${table}.${column}`)
    ).sort(),
    [],
  );

  const column = (table: string, name: string): string => {
    const definition = definitions.get(table)?.get(name);
    assert.ok(definition, `missing ${table}.${name}`);
    return definition.toLowerCase();
  };
  assert.equal(column('users', 'id'), 'bigint generated by default as identity primary key');
  assert.equal(column('users', 'username'), 'text not null unique');
  assert.equal(column('users', 'is_active'), 'boolean not null default true');
  assert.equal(column('auth_sessions', 'token_hash'), 'text primary key');
  assert.equal(
    column('auth_sessions', 'user_id'),
    'bigint references users(id) on delete cascade',
  );
  assert.equal(column('engineering_quotes', 'total'), 'numeric(18,2) default 0');
  assert.equal(column('engineering_quotes', 'items'), 'jsonb');
  assert.equal(column('engineering_quotes', 'created_at'), 'timestamptz not null default now()');
  assert.equal(column('quotation_devices', 'quotation_id'), 'bigint not null references quotation_records(id) on delete cascade');
});

test('indexes and ACL migration preserves required unique and future-object restrictions', () => {
  const sql = fs.readFileSync('src/lib/database/sql/002_indexes_and_constraints.sql', 'utf8');
  const normalized = sql.replace(/\s+/g, ' ');

  assert.match(normalized, /CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_versions_quote ON quote_versions\(quote_type, quote_id, version\)/i);
  assert.match(normalized, /CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_shares_token ON quote_shares\(token\)/i);
  for (const role of ['anon', 'authenticated']) {
    const block = new RegExp(
      `IF EXISTS \\(SELECT 1 FROM pg_roles WHERE rolname = '${role}'\\) THEN([\\s\\S]*?)END IF;`,
      'i',
    ).exec(sql)?.[1];
    assert.ok(block, `missing guarded ACL block for ${role}`);
    assert.match(
      block,
      new RegExp(`ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM ${role}`, 'i'),
    );
    assert.match(
      block,
      new RegExp(`ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM ${role}`, 'i'),
    );
  }
});

test('SQLite import ledger migration stores only recoverable non-secret facts', () => {
  const sql = fs.readFileSync('src/lib/database/sql/003_sqlite_import_runs.sql', 'utf8');
  const normalized = sql.replace(/\s+/g, ' ');

  assert.match(normalized, /CREATE TABLE IF NOT EXISTS sqlite_import_runs/i);
  assert.match(normalized, /source_fingerprint text NOT NULL UNIQUE/i);
  assert.match(normalized, /status text NOT NULL CHECK \(status IN \('complete'\)\)/i);
  assert.match(normalized, /imported_counts jsonb NOT NULL/i);
  assert.match(normalized, /report_json jsonb NOT NULL/i);
  assert.doesNotMatch(normalized, /password_hash|token_hash|api_key/i);
});

test('loads copied SQL assets when only the production dist layout is available', () => {
  const temporaryProject = fs.mkdtempSync(path.join(os.tmpdir(), 'its-migrations-'));
  const distSql = path.join(temporaryProject, 'dist/database/sql');
  fs.mkdirSync(distSql, { recursive: true });
  for (const fileName of [
    '001_initial_schema.sql',
    '002_indexes_and_constraints.sql',
    '003_sqlite_import_runs.sql',
  ]) {
    fs.copyFileSync(path.join('src/lib/database/sql', fileName), path.join(distSql, fileName));
  }
  fs.writeFileSync(path.join(distSql, '999_untrusted.sql'), 'SELECT dangerous_unlisted_sql();');

  const originalWorkingDirectory = process.cwd();
  try {
    process.chdir(temporaryProject);
    assert.deepEqual(loadPostgresMigrations().map(({ version }) => version), [1, 2, 3]);
    assert.equal(
      loadPostgresMigrations().some(({ sql }) => sql.includes('dangerous_unlisted_sql')),
      false,
    );
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

  assert.deepEqual(await runPostgresMigrations(client), { appliedVersions: [1, 2, 3] });
  assert.deepEqual(await runPostgresMigrations(client), { appliedVersions: [] });
  assert.equal(client.transactionCount, 2);
  assert.equal(
    client.queries.filter(({ text }) => /pg_advisory_xact_lock\(49375483\)/i.test(text)).length,
    2,
  );
  assert.deepEqual([...client.versions.keys()], [1, 2, 3]);
});

test('concurrent migration calls serialize safely', async () => {
  const client = new RecordingMigrationClient({ transactionBarrierSize: 2 });
  const migrations = loadPostgresMigrations();

  const results = await Promise.all([
    runPostgresMigrations(client),
    runPostgresMigrations(client),
  ]);

  assert.deepEqual(results, [
    { appliedVersions: [1, 2, 3] },
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
  assert.deepEqual([...client.versions.keys()], [1, 2, 3]);
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
  await assert.rejects(() => runPostgresMigrations(client, { migrations }), (error: unknown) => {
    assert.ok(error instanceof PostgresMigrationError);
    assert.equal(error.stage, 'apply-migration');
    assert.equal(error.version, 10);
    assert.equal('cause' in error, false);
    assert.doesNotMatch(error.message, /synthetic|FAIL THIS MIGRATION/);
    return true;
  });
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
      assert.ok(error instanceof PostgresMigrationError);
      assert.equal(error.stage, 'read-status');
      assert.equal(error.version, undefined);
      assert.doesNotMatch(error.message, /its_admin|top-secret|db\.example\.test/);
      assert.doesNotMatch(error.stack ?? '', /its_admin|top-secret|db\.example\.test/);
      return true;
    },
  );
});

test('database availability errors retain their safe typed identity', async () => {
  const unavailable = new DatabaseUnavailableError();
  const client = new RecordingMigrationClient({
    queryFailure: (text) => /SELECT\s+version\s+FROM\s+schema_migrations/i.test(text)
      ? unavailable
      : undefined,
  });

  await assert.rejects(
    () => runPostgresMigrations(client),
    (error: unknown) => error === unavailable,
  );
});

test('missing migration assets produce a safe classified error', { concurrency: false }, async () => {
  const temporaryProject = fs.mkdtempSync(path.join(os.tmpdir(), 'its-missing-migrations-'));
  const originalWorkingDirectory = process.cwd();
  try {
    process.chdir(temporaryProject);
    await assert.rejects(() => runPostgresMigrations(new RecordingMigrationClient()), (error: unknown) => {
      assert.ok(error instanceof PostgresMigrationError);
      assert.equal(error.stage, 'load-assets');
      assert.equal(error.version, undefined);
      assert.doesNotMatch(error.message, new RegExp(temporaryProject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    });
  } finally {
    process.chdir(originalWorkingDirectory);
    fs.rmSync(temporaryProject, { recursive: true, force: true });
  }
});

const integrationOptions = process.env.TEST_DATABASE_URL
  ? {}
  : { skip: POSTGRES_TEST_SKIP_REASON };

test('PostgreSQL: migrations are idempotent and create the exact canonical schema', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);

  assert.deepEqual(await runPostgresMigrations(harness.client), { appliedVersions: [1, 2, 3] });
  assert.deepEqual(await runPostgresMigrations(harness.client), { appliedVersions: [] });

  const columns = await harness.client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: 'YES' | 'NO';
    is_identity: 'YES' | 'NO';
  }>(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, is_identity
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name NOT IN ('schema_migrations', 'sqlite_import_runs')
    ORDER BY table_name, ordinal_position
  `);
  const actualManifest = new Map<string, Set<string>>();
  for (const { table_name, column_name } of columns.rows) {
    const tableColumns = actualManifest.get(table_name) ?? new Set<string>();
    tableColumns.add(column_name);
    actualManifest.set(table_name, tableColumns);
  }
  assert.deepEqual(
    serializableManifest(actualManifest),
    serializableManifest(buildCanonicalPostgresManifest()),
  );

  const criticalColumn = (table: string, column: string) => {
    const match = columns.rows.find((row) => row.table_name === table && row.column_name === column);
    assert.ok(match, `missing ${table}.${column}`);
    return match;
  };
  assert.deepEqual(criticalColumn('users', 'id'), {
    table_name: 'users', column_name: 'id', data_type: 'bigint', udt_name: 'int8',
    is_nullable: 'NO', is_identity: 'YES',
  });
  assert.equal(criticalColumn('users', 'is_active').data_type, 'boolean');
  assert.equal(criticalColumn('engineering_quotes', 'total').data_type, 'numeric');
  assert.equal(criticalColumn('engineering_quotes', 'items').data_type, 'jsonb');
  assert.equal(criticalColumn('engineering_quotes', 'created_at').data_type, 'timestamp with time zone');

  const foreignKeys = await harness.client.query<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
    delete_rule: string;
  }>(`
    SELECT tc.table_name, kcu.column_name,
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name,
           rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.constraint_schema = kcu.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.constraint_schema = ccu.constraint_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
     AND tc.constraint_schema = rc.constraint_schema
    WHERE tc.constraint_schema = current_schema()
      AND tc.constraint_type = 'FOREIGN KEY'
  `);
  const serializedForeignKeys = foreignKeys.rows.map((row) => Object.values(row).join(':'));
  assert.ok(serializedForeignKeys.includes('auth_sessions:user_id:users:id:CASCADE'));
  assert.ok(serializedForeignKeys.includes('quotation_devices:quotation_id:quotation_records:id:CASCADE'));
  assert.ok(serializedForeignKeys.includes('agent_skills:agent_id:agent_configs:id:CASCADE'));

  const indexes = await harness.client.query<{ indexname: string; indexdef: string }>(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = current_schema()
  `);
  assert.match(
    indexes.rows.find(({ indexname }) => indexname === 'idx_quote_versions_quote')?.indexdef ?? '',
    /UNIQUE INDEX .*quote_versions.*\(quote_type, quote_id, version\)/i,
  );
  assert.match(
    indexes.rows.find(({ indexname }) => indexname === 'idx_quote_shares_token')?.indexdef ?? '',
    /UNIQUE INDEX .*quote_shares.*\(token\)/i,
  );
});

test('PostgreSQL: future objects keep PUBLIC and Data API roles unprivileged', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);
  const roles = await harness.client.query<{ rolname: string }>(`
    SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') ORDER BY rolname
  `);
  await harness.client.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA ${harness.schemaName}
      GRANT ALL ON TABLES TO PUBLIC;
    ALTER DEFAULT PRIVILEGES IN SCHEMA ${harness.schemaName}
      GRANT ALL ON SEQUENCES TO PUBLIC
  `);
  for (const { rolname } of roles.rows) {
    await harness.client.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${harness.schemaName}
        GRANT ALL ON TABLES TO ${rolname};
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${harness.schemaName}
        GRANT ALL ON SEQUENCES TO ${rolname}
    `);
  }

  await runPostgresMigrations(harness.client);
  await harness.client.query(`
    CREATE TABLE acl_future_probe (
      id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      value text
    )
  `);

  const publicAcl = await harness.client.query<{ relation_name: string; public_has_privilege: boolean }>(`
    SELECT c.relname AS relation_name,
           EXISTS (
             SELECT 1
             FROM aclexplode(COALESCE(
               c.relacl,
               acldefault(
                 CASE WHEN c.relkind = 'S' THEN 'S'::"char" ELSE 'r'::"char" END,
                 c.relowner
               )
             )) acl
             WHERE acl.grantee = 0
           ) AS public_has_privilege
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname IN ('acl_future_probe', 'acl_future_probe_id_seq')
    ORDER BY c.relname
  `);
  assert.deepEqual(publicAcl.rows, [
    { relation_name: 'acl_future_probe', public_has_privilege: false },
    { relation_name: 'acl_future_probe_id_seq', public_has_privilege: false },
  ]);

  for (const { rolname } of roles.rows) {
    const privileges = await harness.client.query<{ table_access: boolean; sequence_access: boolean }>(`
      SELECT
        has_table_privilege($1, 'acl_future_probe', 'SELECT')
          OR has_table_privilege($1, 'acl_future_probe', 'INSERT')
          OR has_table_privilege($1, 'acl_future_probe', 'UPDATE')
          OR has_table_privilege($1, 'acl_future_probe', 'DELETE') AS table_access,
        has_sequence_privilege($1, 'acl_future_probe_id_seq', 'USAGE')
          OR has_sequence_privilege($1, 'acl_future_probe_id_seq', 'SELECT')
          OR has_sequence_privilege($1, 'acl_future_probe_id_seq', 'UPDATE') AS sequence_access
    `, [rolname]);
    assert.deepEqual(privileges.rows[0], { table_access: false, sequence_access: false });
  }
});

test('PostgreSQL: concurrent runners apply every migration once', integrationOptions, async (t) => {
  const harness = await createPostgresTestHarness(t);
  const secondClient = harness.createAdditionalClient();

  const results = await Promise.all([
    runPostgresMigrations(harness.client),
    runPostgresMigrations(secondClient),
  ]);

  assert.deepEqual(results.flatMap(({ appliedVersions }) => appliedVersions).sort(), [1, 2, 3]);
  const versions = await harness.client.query<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  assert.deepEqual(versions.rows.map(({ version }) => version), [1, 2, 3]);
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
