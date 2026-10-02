import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';

type Row = Record<string, unknown>;

class SuggestionsDatabase implements DatabaseClient {
  role: 'admin' | 'its_member' = 'admin';
  username = 'admin';
  name = '管理员';
  readonly suggestionQueries: Array<{ text: string; params: readonly unknown[] }> = [];

  async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    if (text.includes('DELETE FROM auth_sessions WHERE expires_at')) {
      return { rows: [], rowCount: 0 } as QueryResult<ResultRow>;
    }
    if (text.includes('SELECT role, user_id, username, name, expires_at FROM auth_sessions')) {
      return {
        rows: [{
          role: this.role,
          user_id: null,
          username: this.username,
          name: this.name,
          expires_at: Date.now() + 60_000,
        }],
        rowCount: 1,
      } as unknown as QueryResult<ResultRow>;
    }
    if (text.includes('UPDATE auth_sessions SET last_seen_at')) {
      return { rows: [], rowCount: 1 } as QueryResult<ResultRow>;
    }
    if (text.includes('SELECT id, name FROM users WHERE username = $1')) {
      return {
        rows: [{ id: 1, name: this.name }],
        rowCount: 1,
      } as unknown as QueryResult<ResultRow>;
    }
    if (text.includes('FROM device_suggestions')) {
      this.suggestionQueries.push({ text, params });
      return { rows: [], rowCount: 0 } as QueryResult<ResultRow>;
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return await work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

type DatabaseGlobal = typeof globalThis & {
  __itsPostgresDatabaseClient__?: DatabaseClient;
};

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { authorization: 'Bearer test-session-token' },
  });
}

test('device suggestion listing is admin-only unless a member explicitly requests their own records', async () => {
  const database = new SuggestionsDatabase();
  const global = globalThis as DatabaseGlobal;
  const previousDatabase = global.__itsPostgresDatabaseClient__;
  global.__itsPostgresDatabaseClient__ = database;
  try {
    const route = await import('../src/app/api/device-suggestions/route');

    database.role = 'its_member';
    database.username = 'member_a';
    database.name = '成员A';
    const denied = await route.GET(request('/api/device-suggestions'));
    assert.equal(denied.status, 403);
    assert.equal(database.suggestionQueries.length, 0);

    const own = await route.GET(request('/api/device-suggestions?mine=true'));
    assert.equal(own.status, 200);
    assert.match(database.suggestionQueries[0]?.text ?? '', /submitted_by\s*=\s*\$1/);
    assert.deepEqual(database.suggestionQueries[0]?.params, ['成员A']);

    database.role = 'admin';
    const all = await route.GET(request('/api/device-suggestions'));
    assert.equal(all.status, 200);
    assert.doesNotMatch(database.suggestionQueries[1]?.text ?? '', /submitted_by\s*=/);
  } finally {
    if (previousDatabase) global.__itsPostgresDatabaseClient__ = previousDatabase;
    else delete global.__itsPostgresDatabaseClient__;
  }
});
