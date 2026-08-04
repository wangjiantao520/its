import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';

import postgres from 'postgres';

import type { DatabaseClient, QueryResult } from '../../src/lib/database/client';

export const POSTGRES_TEST_SKIP_REASON =
  'PostgreSQL integration test skipped: TEST_DATABASE_URL is not configured.';

function toQueryResult<Row extends Record<string, unknown>>(
  rows: Row[] & { count?: number | null },
): QueryResult<Row> {
  return {
    rows: Array.from(rows),
    rowCount: rows.count ?? rows.length,
  };
}

function createClient(
  sql: postgres.Sql | postgres.TransactionSql,
  transactionScoped = false,
): DatabaseClient {
  return {
    query: async <Row extends Record<string, unknown>>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<QueryResult<Row>> => {
      const rows = await sql.unsafe<Row[]>(text, Array.from(params) as postgres.ParameterOrJSON<never>[]);
      return toQueryResult(rows);
    },
    transaction: async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> => {
      const result = transactionScoped
        ? await (sql as postgres.TransactionSql).savepoint(async (savepointSql) => ({
          value: await work(createClient(savepointSql, true)),
        }))
        : await (sql as postgres.Sql).begin(async (transactionSql) => ({
          value: await work(createClient(transactionSql, true)),
        }));
      return result.value;
    },
    healthCheck: async (): Promise<void> => {
      await sql`SELECT 1`;
    },
    close: async (): Promise<void> => {
      if (!transactionScoped) await (sql as postgres.Sql).end();
    },
  };
}

export interface PostgresTestHarness {
  schemaName: string;
  client: DatabaseClient;
  createAdditionalClient(): DatabaseClient;
}

export async function createPostgresTestHarness(t: TestContext): Promise<PostgresTestHarness> {
  const url = process.env.TEST_DATABASE_URL?.trim();
  assert.ok(url, POSTGRES_TEST_SKIP_REASON);

  const schemaName = `its_test_${randomUUID().replaceAll('-', '')}`;
  const admin = postgres(url, { max: 1, prepare: false });
  await admin.unsafe(`CREATE SCHEMA ${schemaName}`);

  const clients: DatabaseClient[] = [];
  const createAdditionalClient = (): DatabaseClient => {
    const sql = postgres(url, {
      max: 1,
      prepare: false,
      connection: { search_path: schemaName },
    });
    const client = createClient(sql);
    clients.push(client);
    return client;
  };

  t.after(async () => {
    for (const client of clients) {
      await client.close();
    }
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await admin.end();
  });

  return {
    schemaName,
    client: createAdditionalClient(),
    createAdditionalClient,
  };
}
