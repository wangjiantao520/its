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

type PostgresQueryResult<Row extends Record<string, unknown>> = Row[] & {
  count: number;
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
): Promise<QueryResult<Row>> {
  try {
    const result = await sql.unsafe<PostgresQueryResult<Row>>(text, bindParameters(params), {
      prepare: false,
    });
    return {
      rows: Array.from(result),
      rowCount: result.count,
    };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      throw toDatabaseUnavailableError(error);
    }
    throw error;
  }
}

function createTransactionClient(sql: postgres.TransactionSql): DatabaseClient {
  return {
    query: <Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) =>
      runQuery<Row>(sql, text, params),
    transaction: async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> => {
      try {
        const result = await sql.savepoint(async (savepointSql) => ({
          value: await work(createTransactionClient(savepointSql)),
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
      await runQuery<Record<string, unknown>>(sql, 'SELECT 1', []);
    },
    close: async (): Promise<void> => {},
  };
}

function createRootClient(sql: postgres.Sql): DatabaseClient {
  return {
    query: <Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) =>
      runQuery<Row>(sql, text, params),
    transaction: async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> => {
      try {
        const result = await sql.begin(async (transactionSql) => ({
          value: await work(createTransactionClient(transactionSql)),
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
      await runQuery<Record<string, unknown>>(sql, 'SELECT 1', []);
    },
    close: async (): Promise<void> => {
      await sql.end();
    },
  };
}

export function redactDatabaseUrl(value: string): string {
  return value.replace(
    /^([a-z][a-z\d+.-]*:\/\/)([^@]*)@/i,
    (match, protocol: string, credentials: string) => {
      const separatorIndex = credentials.indexOf(':');
      if (separatorIndex === -1) {
        return match;
      }
      return `${protocol}${credentials.slice(0, separatorIndex)}:***@`;
    },
  );
}

export function createDatabaseClient(options: DatabaseClientOptions): DatabaseClient {
  const url = options.url.trim();
  if (!url) {
    throw new Error('DATABASE_URL must be configured before using PostgreSQL.');
  }

  const sql = postgres(url, {
    ssl: 'require',
    prepare: options.prepare ?? false,
    max: options.max ?? 10,
    connect_timeout: 10,
    idle_timeout: 20,
  });

  return createRootClient(sql);
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
