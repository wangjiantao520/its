import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDatabaseClient,
  redactDatabaseUrl,
  type DatabaseClient,
  type QueryResult,
} from '../src/lib/database/client';
import { DatabaseUnavailableError, toDatabaseUnavailableError } from '../src/lib/database/errors';

test('redactDatabaseUrl hides credentials', () => {
  assert.equal(
    redactDatabaseUrl('postgres://user:secret@db.example.com:6543/postgres'),
    'postgres://user:***@db.example.com:6543/postgres',
  );
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
