import postgres from 'postgres';
import { Pool, type PoolConfig, type QueryResult as PgQueryResult, type QueryResultRow } from 'pg';

import { isDatabaseUnavailableError, toDatabaseUnavailableError } from './errors';

export interface QueryResult<Row extends Record<string, unknown>> {
  rows: Row[];
  rowCount: number;
}

export interface DatabaseClient {
  query<Row extends Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
  transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T>;
  healthCheck(): Promise<void>;
  close(): Promise<void>;
}

export interface DatabaseClientOptions {
  url: string;
  max?: number;
  prepare?: boolean;
  driver?: 'postgresjs' | 'pg';
}

type CreateSql = (
  url: string,
  options: NonNullable<Parameters<typeof postgres>[1]>,
) => postgres.Sql;

export interface DatabaseClientDependencies {
  createSql?: CreateSql;
  createPool?: (config: PoolConfig) => PgPoolLike;
}

type PostgresQueryResult<Row extends Record<string, unknown>> = Row[] & {
  count: number | null;
};

type PostgresParameter = postgres.ParameterOrJSON<never>;

type DatabaseGlobal = typeof globalThis & {
  __itsPostgresDatabaseClient__?: DatabaseClient;
};

type PgClientLike = {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<PgQueryResult<Row>>;
  release(): void;
};

type PgPoolLike = {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<PgQueryResult<Row>>;
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
  on?(event: 'error', listener: (error: Error) => void): void;
};

function bindParameters(params: readonly unknown[]): PostgresParameter[] {
  return Array.from(params) as PostgresParameter[];
}

async function runQuery<Row extends Record<string, unknown>>(
  sql: postgres.ISql,
  text: string,
  params: readonly unknown[],
  prepare: boolean,
): Promise<QueryResult<Row>> {
  try {
    const result = await sql.unsafe<PostgresQueryResult<Row>>(text, bindParameters(params), {
      prepare,
    });
    return {
      rows: Array.from(result),
      rowCount: result.count ?? 0,
    };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      throw toDatabaseUnavailableError(error);
    }
    throw error;
  }
}

function createTransactionClient(sql: postgres.TransactionSql, prepare: boolean): DatabaseClient {
  return {
    query: <Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) =>
      runQuery<Row>(sql, text, params, prepare),
    transaction: async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> => {
      try {
        const result = await sql.savepoint(async (savepointSql) => ({
          value: await work(createTransactionClient(savepointSql, prepare)),
        }));
        return result.value;
      } catch (error) {
        if (isDatabaseUnavailableError(error)) {
          throw toDatabaseUnavailableError(error);
        }
        throw error;
      }
    },
    healthCheck: async (): Promise<void> => {
      await runQuery<Record<string, unknown>>(sql, 'SELECT 1', [], prepare);
    },
    close: async (): Promise<void> => {},
  };
}

function createRootClient(sql: postgres.Sql, prepare: boolean): DatabaseClient {
  return {
    query: <Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) =>
      runQuery<Row>(sql, text, params, prepare),
    transaction: async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> => {
      try {
        const result = await sql.begin(async (transactionSql) => ({
          value: await work(createTransactionClient(transactionSql, prepare)),
        }));
        return result.value;
      } catch (error) {
        if (isDatabaseUnavailableError(error)) {
          throw toDatabaseUnavailableError(error);
        }
        throw error;
      }
    },
    healthCheck: async (): Promise<void> => {
      await runQuery<Record<string, unknown>>(sql, 'SELECT 1', [], prepare);
    },
    close: async (): Promise<void> => {
      await sql.end();
    },
  };
}

function throwMappedDatabaseError(error: unknown): never {
  if (isDatabaseUnavailableError(error)) {
    throw toDatabaseUnavailableError(error);
  }
  throw error;
}

function normalizePgResult<Row extends Record<string, unknown>>(
  result: PgQueryResult<Row>,
): QueryResult<Row> {
  return {
    rows: result.rows,
    rowCount: result.rowCount ?? result.rows.length,
  };
}

async function runPgQuery<Row extends Record<string, unknown>>(
  client: Pick<PgClientLike, 'query'>,
  text: string,
  params: readonly unknown[],
): Promise<QueryResult<Row>> {
  try {
    const result = await client.query<Row>(text, Array.from(params));
    return normalizePgResult(result);
  } catch (error) {
    return throwMappedDatabaseError(error);
  }
}

function createPgTransactionClient(client: PgClientLike, savepointCounter: { value: number }): DatabaseClient {
  return {
    query: <Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) =>
      runPgQuery<Row>(client, text, params),
    transaction: async <T>(work: (nestedClient: DatabaseClient) => Promise<T>): Promise<T> => {
      const savepoint = `its_savepoint_${++savepointCounter.value}`;
      try {
        await runPgQuery(client, `SAVEPOINT ${savepoint}`, []);
        const result = await work(createPgTransactionClient(client, savepointCounter));
        await runPgQuery(client, `RELEASE SAVEPOINT ${savepoint}`, []);
        return result;
      } catch (error) {
        await runPgQuery(client, `ROLLBACK TO SAVEPOINT ${savepoint}`, []).catch(() => undefined);
        throwMappedDatabaseError(error);
      }
    },
    healthCheck: async (): Promise<void> => {
      await runPgQuery<Record<string, unknown>>(client, 'SELECT 1', []);
    },
    close: async (): Promise<void> => {},
  };
}

function createPgRootClient(pool: PgPoolLike): DatabaseClient {
  return {
    query: <Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) =>
      runPgQuery<Row>(pool, text, params),
    transaction: async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> => {
      let client: PgClientLike | undefined;
      try {
        client = await pool.connect();
        await runPgQuery(client, 'BEGIN', []);
        const result = await work(createPgTransactionClient(client, { value: 0 }));
        await runPgQuery(client, 'COMMIT', []);
        return result;
      } catch (error) {
        if (client) {
          await runPgQuery(client, 'ROLLBACK', []).catch(() => undefined);
        }
        throwMappedDatabaseError(error);
      } finally {
        client?.release();
      }
    },
    healthCheck: async (): Promise<void> => {
      await runPgQuery<Record<string, unknown>>(pool, 'SELECT 1', []);
    },
    close: async (): Promise<void> => {
      await pool.end();
    },
  };
}

function secureConnectionString(value: string): string {
  const parsed = new URL(value);
  // node-postgres lets SSL query parameters override the `ssl` option. Remove
  // those overrides so the pool always verifies TLS using Node's trust store.
  for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) {
    parsed.searchParams.delete(key);
  }
  return parsed.toString();
}

function getPgSslConfig(): PoolConfig['ssl'] {
  const encodedCa = process.env.SUPABASE_DB_CA_CERT_BASE64?.replace(/\s+/g, '');
  if (!encodedCa) return true;

  const ca = Buffer.from(encodedCa, 'base64');
  const caPem = ca.toString('utf8');
  if (
    ca.length === 0 ||
    !caPem.includes('-----BEGIN CERTIFICATE-----') ||
    ca.toString('base64') !== encodedCa
  ) {
    throw new Error('SUPABASE_DB_CA_CERT_BASE64 must contain a base64-encoded PEM certificate.');
  }

  return { ca: caPem, rejectUnauthorized: true };
}

export function redactDatabaseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (!parsed.username && !parsed.password) {
      return value;
    }
  } catch {
    // The fallback below must still remove a malformed connection string's password.
  }

  const authorityMatch = /^([a-z][a-z\d+.-]*:\/\/)([^/?#]*)([\s\S]*)$/i.exec(value);
  if (!authorityMatch) {
    return '<redacted database URL>';
  }

  const [, protocol, authority, suffix] = authorityMatch;
  const atIndex = authority.lastIndexOf('@');
  if (atIndex !== -1) {
    const credentials = authority.slice(0, atIndex);
    const passwordIndex = credentials.indexOf(':');
    if (passwordIndex === -1) {
      return `${protocol}${credentials}@${authority.slice(atIndex + 1)}${suffix}`;
    }
    return `${protocol}${credentials.slice(0, passwordIndex)}:***@${authority.slice(atIndex + 1)}${suffix}`;
  }

  const passwordIndex = authority.indexOf(':');
  if (passwordIndex !== -1) {
    return `${protocol}${authority.slice(0, passwordIndex)}:***${suffix}`;
  }

  return '<redacted database URL>';
}

export function createDatabaseClient(
  options: DatabaseClientOptions,
  dependencies: DatabaseClientDependencies = {},
): DatabaseClient {
  const url = options.url.trim();
  if (!url) {
    throw new Error('DATABASE_URL must be configured before using PostgreSQL.');
  }

  const usePg = options.driver === 'pg' || (!options.driver && process.env.VERCEL === '1');
  const max = options.max ?? (process.env.VERCEL === '1' ? 1 : 10);

  if (usePg) {
    const config: PoolConfig = {
      connectionString: secureConnectionString(url),
      ssl: getPgSslConfig(),
      max,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 20_000,
      query_timeout: 30_000,
    };
    const pool = dependencies.createPool
      ? dependencies.createPool(config)
      : new Pool(config) as unknown as PgPoolLike;
    pool.on?.('error', () => {
      console.warn('An idle PostgreSQL connection was closed.');
    });
    return createPgRootClient(pool);
  }

  const prepare = options.prepare ?? false;
  const sql = (dependencies.createSql ?? postgres)(url, {
    ssl: 'require',
    prepare,
    max,
    connect_timeout: 10,
    idle_timeout: 20,
  });

  return createRootClient(sql, prepare);
}

export function getDatabase(): DatabaseClient {
  const globalDatabase = globalThis as DatabaseGlobal;
  if (!globalDatabase.__itsPostgresDatabaseClient__) {
    const configuredMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '', 10);
    const defaultMax = process.env.VERCEL === '1' ? 1 : 10;
    globalDatabase.__itsPostgresDatabaseClient__ = createDatabaseClient({
      url: process.env.DATABASE_URL ?? '',
      max: Number.isSafeInteger(configuredMax) && configuredMax > 0 ? configuredMax : defaultMax,
      driver: process.env.VERCEL === '1' ? 'pg' : 'postgresjs',
    });
  }
  return globalDatabase.__itsPostgresDatabaseClient__;
}
