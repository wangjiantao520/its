import assert from 'node:assert/strict';
import test from 'node:test';

import { runMigrationCli } from '../scripts/migrate-db.mjs';
import type { DatabaseClient, QueryResult } from '../src/lib/database/client';

class CliDatabaseClient implements DatabaseClient {
  healthCheckCount = 0;
  closeCount = 0;

  async query<Row extends Record<string, unknown>>(): Promise<QueryResult<Row>> {
    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return work(this);
  }

  async healthCheck(): Promise<void> {
    this.healthCheckCount += 1;
  }

  async close(): Promise<void> {
    this.closeCount += 1;
  }
}

test('migration CLI prints only one applied version number per line', async () => {
  const client = new CliDatabaseClient();
  const stdout: string[] = [];
  const stderr: string[] = [];

  const exitCode = await runMigrationCli({
    env: { DATABASE_MIGRATION_URL: 'postgres://safe-placeholder' },
    createClient: () => client,
    runMigrations: async () => ({ appliedVersions: [1, 2] }),
    writeStdout: (message) => stdout.push(message),
    writeStderr: (message) => stderr.push(message),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stdout, ['1', '2']);
  assert.deepEqual(stderr, []);
  assert.equal(client.healthCheckCount, 1);
  assert.equal(client.closeCount, 1);
});

test('migration CLI stays silent when the schema is current', async () => {
  const client = new CliDatabaseClient();
  const stdout: string[] = [];
  const stderr: string[] = [];

  const exitCode = await runMigrationCli({
    env: { DATABASE_URL: 'postgres://safe-placeholder' },
    createClient: () => client,
    runMigrations: async () => ({ appliedVersions: [] }),
    writeStdout: (message) => stdout.push(message),
    writeStderr: (message) => stderr.push(message),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stdout, []);
  assert.deepEqual(stderr, []);
  assert.equal(client.healthCheckCount, 1);
  assert.equal(client.closeCount, 1);
});
