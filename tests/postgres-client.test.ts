import assert from 'node:assert/strict';
import test from 'node:test';
import type postgres from 'postgres';

import {
  createDatabaseClient,
  getDatabase,
  redactDatabaseUrl,
  type DatabaseClient,
  type DatabaseClientDependencies,
  type QueryResult,
} from '../src/lib/database/client';
import {
  DatabaseUnavailableError,
  isDatabaseUnavailableError,
  toDatabaseUnavailableError,
} from '../src/lib/database/errors';

type FakeRow = Record<string, unknown>;

type RecordedQuery = {
  text: string;
  params: unknown[];
  prepare: boolean | undefined;
};

type RecordedConfig = {
  url: string;
  options: NonNullable<Parameters<NonNullable<DatabaseClientDependencies['createSql']>>[1]>;
};

type RecordingSql = {
  createSql: NonNullable<DatabaseClientDependencies['createSql']>;
  queries: RecordedQuery[];
  configs: RecordedConfig[];
  beginCount: number;
  savepointCount: number;
  rollbackCount: number;
  endCount: number;
};

function createRecordingSql(options: { rows?: FakeRow[]; count?: number | null; failure?: unknown } = {}): RecordingSql {
  const queries: RecordedQuery[] = [];
  const configs: RecordedConfig[] = [];
  const result = Object.assign(options.rows ?? [], { count: options.count === undefined ? 1 : options.count });
  let beginCount = 0;
  let savepointCount = 0;
  let rollbackCount = 0;
  let endCount = 0;

  const unsafe = (
    text: string,
    params: unknown[] = [],
    queryOptions: { prepare?: boolean } = {},
  ): Promise<typeof result> => {
    queries.push({ text, params: Array.from(params), prepare: queryOptions.prepare });
    if (options.failure !== undefined) {
      return Promise.reject(options.failure);
    }
    return Promise.resolve(result);
  };

  const transactionSql = {
    unsafe,
    savepoint: async (work: (sql: postgres.TransactionSql) => unknown): Promise<unknown> => {
      savepointCount += 1;
      try {
        return await work(transactionSql as unknown as postgres.TransactionSql);
      } catch (error) {
        rollbackCount += 1;
        throw error;
      }
    },
  };
  const rootSql = {
    unsafe,
    begin: async (work: (sql: postgres.TransactionSql) => unknown): Promise<unknown> => {
      beginCount += 1;
      try {
        return await work(transactionSql as unknown as postgres.TransactionSql);
      } catch (error) {
        rollbackCount += 1;
        throw error;
      }
    },
    end: async (): Promise<void> => {
      endCount += 1;
    },
  };

  const createSql: NonNullable<DatabaseClientDependencies['createSql']> = (url, clientOptions) => {
    configs.push({ url, options: clientOptions });
    return rootSql as unknown as postgres.Sql;
  };

  return {
    createSql,
    queries,
    configs,
    get beginCount() {
      return beginCount;
    },
    get savepointCount() {
      return savepointCount;
    },
    get rollbackCount() {
      return rollbackCount;
    },
    get endCount() {
      return endCount;
    },
  };
}

test('redactDatabaseUrl hides credentials', () => {
  assert.equal(
    redactDatabaseUrl('postgres://user:secret@db.example.com:6543/postgres'),
    'postgres://user:***@db.example.com:6543/postgres',
  );
});

test('redactDatabaseUrl hides literal and encoded password special characters', () => {
  const expected = 'postgres://user:***@db.example.com:6543/postgres?sslmode=require';

  assert.equal(
    redactDatabaseUrl('postgres://user:p@ss:word@db.example.com:6543/postgres?sslmode=require'),
    expected,
  );
  assert.equal(
    redactDatabaseUrl('postgres://user:p%40ss%3Aword@db.example.com:6543/postgres?sslmode=require'),
    expected,
  );
  assert.equal(redactDatabaseUrl('postgres://user:secret@'), 'postgres://user:***@');
});

test('createDatabaseClient rejects a missing URL', () => {
  assert.throws(() => createDatabaseClient({ url: '' }), /DATABASE_URL/);
});

test('unavailable database errors never expose connection credentials', () => {
  const secretUrl = 'postgres://user:secret@db.example.com:6543/postgres';
  const error = toDatabaseUnavailableError({
    code: 'ECONNREFUSED',
    message: `connect ECONNREFUSED ${secretUrl}`,
  });

  assert.ok(error instanceof DatabaseUnavailableError);
  assert.equal(error.message, 'Database is temporarily unavailable. Please try again later.');
  assert.doesNotMatch(error.message, /user|secret|db\.example\.com/);
  assert.doesNotMatch(error.stack ?? '', /user|secret|db\.example\.com/);
});

test('classifies DNS and PostgreSQL availability failures without classifying SQL errors', () => {
  for (const code of [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    '57P01',
    '57P02',
    '57P03',
    '53300',
    '08006',
  ]) {
    assert.equal(isDatabaseUnavailableError({ code }), true, `expected ${code} to be unavailable`);
  }

  assert.equal(isDatabaseUnavailableError({ code: '23505' }), false);
  assert.equal(isDatabaseUnavailableError({ code: '42601' }), false);
  assert.equal(isDatabaseUnavailableError({ code: '57014' }), false);
});

test('query maps injected unavailable failures without exposing raw connection details', async () => {
  const secretUrl = 'postgres://user:secret@db.example.com:6543/postgres';
  const sql = {
    unsafe: () => Promise.reject({
      code: 'EAI_AGAIN',
      message: `getaddrinfo EAI_AGAIN ${secretUrl}`,
    }),
  } as unknown as postgres.Sql;
  const client = createDatabaseClient(
    { url: secretUrl },
    { createSql: () => sql },
  );

  await assert.rejects(
    () => client.query('SELECT $1', [secretUrl]),
    (error: unknown) => {
      assert.ok(error instanceof DatabaseUnavailableError);
      assert.equal(error.message, 'Database is temporarily unavailable. Please try again later.');
      assert.doesNotMatch(error.message, /user|secret|db\.example\.com/);
      assert.doesNotMatch(error.stack ?? '', /user|secret|db\.example\.com/);
      return true;
    },
  );
});

test('query preserves non-availability database errors', async () => {
  const cancellation = Object.assign(new Error('query cancelled'), { code: '57014' });
  const recording = createRecordingSql({ failure: cancellation });
  const client = createDatabaseClient(
    { url: 'postgres://user:secret@db.example.com:6543/postgres' },
    { createSql: recording.createSql },
  );

  await assert.rejects(() => client.query('SELECT pg_sleep($1)', [1]), (error: unknown) => error === cancellation);
});

test('configured client propagates explicit prepare and pool options to every query scope', async () => {
  const recording = createRecordingSql({ rows: [{ id: 7 }], count: 1 });
  const client = createDatabaseClient(
    { url: 'postgres://user:secret@db.example.com:6543/postgres', max: 3, prepare: true },
    { createSql: recording.createSql },
  );

  assert.deepEqual(recording.configs, [{
    url: 'postgres://user:secret@db.example.com:6543/postgres',
    options: {
      ssl: 'require',
      prepare: true,
      max: 3,
      connect_timeout: 10,
      idle_timeout: 20,
    },
  }]);
  assert.deepEqual(await client.query<{ id: number }>('SELECT $1 AS id', [7]), {
    rows: [{ id: 7 }],
    rowCount: 1,
  });
  await client.transaction(async (transactionClient) => {
    await transactionClient.query('SELECT $1', ['transaction']);
    await transactionClient.transaction(async (nestedClient) => {
      await nestedClient.query('SELECT $1', ['savepoint']);
    });
  });

  assert.equal(recording.beginCount, 1);
  assert.equal(recording.savepointCount, 1);
  assert.deepEqual(recording.queries.map((query) => query.prepare), [true, true, true]);
});

test('client defaults prepare off and maps a null driver count to zero', async () => {
  const recording = createRecordingSql({ rows: [{ id: 8 }], count: null });
  const client = createDatabaseClient(
    { url: 'postgres://user:secret@db.example.com:6543/postgres' },
    { createSql: recording.createSql },
  );

  assert.deepEqual(await client.query<{ id: number }>('SELECT $1 AS id', [8]), {
    rows: [{ id: 8 }],
    rowCount: 0,
  });
  assert.equal(recording.configs[0]?.options.prepare, false);
  assert.deepEqual(recording.queries[0], {
    text: 'SELECT $1 AS id',
    params: [8],
    prepare: false,
  });
});

test('health check, close, and rollback propagate through the database client', async () => {
  const recording = createRecordingSql();
  const client = createDatabaseClient(
    { url: 'postgres://user:secret@db.example.com:6543/postgres' },
    { createSql: recording.createSql },
  );

  await client.healthCheck();
  await client.close();
  const failure = new Error('work failed');
  await assert.rejects(() => client.transaction(async () => {
    throw failure;
  }), (error: unknown) => error === failure);

  assert.equal(recording.queries[0]?.text, 'SELECT 1');
  assert.equal(recording.endCount, 1);
  assert.equal(recording.beginCount, 1);
  assert.equal(recording.rollbackCount, 1);
});

test('getDatabase validates lazily and caches without issuing a query', async () => {
  type DatabaseGlobal = typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  const databaseGlobal = globalThis as DatabaseGlobal;
  const previousUrl = process.env.DATABASE_URL;
  delete databaseGlobal.__itsPostgresDatabaseClient__;

  try {
    delete process.env.DATABASE_URL;
    assert.throws(() => getDatabase(), /DATABASE_URL/);

    process.env.DATABASE_URL = 'postgres://user:secret@db.example.com:6543/postgres';
    const client = getDatabase();
    assert.equal(getDatabase(), client);
    await client.close();
  } finally {
    delete databaseGlobal.__itsPostgresDatabaseClient__;
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
  }
});

test('database client has typed query, transaction, health, and close contracts', () => {
  const factory: (options: { url: string; max?: number; prepare?: boolean }) => DatabaseClient =
    createDatabaseClient;
  const query: DatabaseClient['query'] = async <Row extends Record<string, unknown>>(): Promise<QueryResult<Row>> => ({
    rows: [],
    rowCount: 0,
  });
  const healthCheck: DatabaseClient['healthCheck'] = async (): Promise<void> => {};
  const close: DatabaseClient['close'] = async (): Promise<void> => {};
  const transaction: DatabaseClient['transaction'] = async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> =>
    work({ query, transaction, healthCheck, close });

  assert.equal(typeof factory, 'function');
  assert.equal(typeof query, 'function');
  assert.equal(typeof transaction, 'function');
  assert.equal(typeof healthCheck, 'function');
  assert.equal(typeof close, 'function');
});
