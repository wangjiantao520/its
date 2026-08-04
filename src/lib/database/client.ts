import postgres from 'postgres';

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
}

type CreateSql = (
  url: string,
  options: NonNullable<Parameters<typeof postgres>[1]>,
) => postgres.Sql;

export interface DatabaseClientDependencies {
  createSql?: CreateSql;
}

type PostgresQueryResult<Row extends Record<string, unknown>> = Row[] & {
  count: number | null;
};

type PostgresParameter = postgres.ParameterOrJSON<never>;

type DatabaseGlobal = typeof globalThis & {
  __itsPostgresDatabaseClient__?: DatabaseClient;
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

  const prepare = options.prepare ?? false;
  const sql = (dependencies.createSql ?? postgres)(url, {
    ssl: 'require',
    prepare,
    max: options.max ?? 10,
    connect_timeout: 10,
    idle_timeout: 20,
  });

  return createRootClient(sql, prepare);
}

export function getDatabase(): DatabaseClient {
  const globalDatabase = globalThis as DatabaseGlobal;
  if (!globalDatabase.__itsPostgresDatabaseClient__) {
    globalDatabase.__itsPostgresDatabaseClient__ = createDatabaseClient({
      url: process.env.DATABASE_URL ?? '',
    });
  }
  return globalDatabase.__itsPostgresDatabaseClient__;
}
