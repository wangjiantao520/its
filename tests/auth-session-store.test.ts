import assert from 'node:assert/strict';
import test from 'node:test';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import {
  deleteSessionsForUser,
  deleteSession,
  findSession,
  hashAuthToken,
  saveSession,
} from '../src/lib/auth-session-store';

interface StoredSession {
  tokenHash: string;
  role: string;
  userId: number | null;
  username: string | null;
  name: string | null;
  expiresAt: number;
}

class SessionDatabase implements DatabaseClient {
  readonly sessions = new Map<string, StoredSession>();
  readonly queries: Array<{ text: string; params: readonly unknown[] }> = [];

  async query<Row extends Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ text, params });
    const normalized = text.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('DELETE FROM auth_sessions WHERE expires_at <= $1')) {
      let count = 0;
      for (const [tokenHash, session] of this.sessions) {
        if (session.expiresAt <= Number(params[0])) {
          this.sessions.delete(tokenHash);
          count += 1;
        }
      }
      return { rows: [], rowCount: count };
    }

    if (normalized.startsWith('INSERT INTO auth_sessions')) {
      this.sessions.set(String(params[0]), {
        tokenHash: String(params[0]),
        role: String(params[1]),
        userId: params[2] === null ? null : Number(params[2]),
        username: params[3] === null ? null : String(params[3]),
        name: params[4] === null ? null : String(params[4]),
        expiresAt: Number(params[5]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith('SELECT role, user_id, username, name, expires_at FROM auth_sessions')) {
      const session = this.sessions.get(String(params[0]));
      return {
        rows: session ? [{
          role: session.role,
          user_id: session.userId === null ? null : String(session.userId),
          username: session.username,
          name: session.name,
          expires_at: String(session.expiresAt),
        } as unknown as Row] : [],
        rowCount: session ? 1 : 0,
      };
    }

    if (normalized.startsWith('UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP')) {
      return { rows: [], rowCount: this.sessions.has(String(params[0])) ? 1 : 0 };
    }

    if (normalized.startsWith('DELETE FROM auth_sessions WHERE token_hash = $1')) {
      const deleted = this.sessions.delete(String(params[0]));
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }

    if (normalized.startsWith('DELETE FROM auth_sessions WHERE user_id = $1')) {
      let count = 0;
      for (const [tokenHash, session] of this.sessions) {
        if (session.userId === Number(params[0])) {
          this.sessions.delete(tokenHash);
          count += 1;
        }
      }
      return { rows: [], rowCount: count };
    }

    throw new Error(`Unexpected SQL: ${normalized}`);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

test('stores only a token hash and restores an unexpired session asynchronously', async () => {
  const database = new SessionDatabase();
  const token = 'plain-secret-token';

  await saveSession(database, token, {
    role: 'its_member',
    userId: 7,
    username: 'member',
    name: '成员',
    expiresAt: 2_000,
  }, 1_000);

  assert.deepEqual([...database.sessions.keys()], [hashAuthToken(token)]);
  assert.equal(database.sessions.has(token), false);
  assert.deepEqual(await findSession(database, token, 1_000), {
    role: 'its_member',
    userId: 7,
    username: 'member',
    name: '成员',
    expiresAt: 2_000,
  });
  assert.ok(database.queries.every(({ text }) => !text.includes('?')));
});

test('revokes every active session for a database user', async () => {
  const database = new SessionDatabase();
  await saveSession(database, 'first-device', { role: 'its_member', userId: 9, expiresAt: 500 }, 100);
  await saveSession(database, 'second-device', { role: 'its_member', userId: 9, expiresAt: 500 }, 100);
  await saveSession(database, 'another-user', { role: 'its_member', userId: 10, expiresAt: 500 }, 100);

  assert.equal(await deleteSessionsForUser(database, 9), 2);
  assert.equal(await findSession(database, 'first-device', 200), null);
  assert.equal(await findSession(database, 'second-device', 200), null);
  assert.notEqual(await findSession(database, 'another-user', 200), null);
});

test('expired and revoked sessions cannot be restored', async () => {
  const database = new SessionDatabase();
  await saveSession(database, 'expired', { role: 'admin', expiresAt: 100 }, 50);
  assert.equal(await findSession(database, 'expired', 101), null);
  assert.equal(database.sessions.size, 0);

  await saveSession(database, 'active', { role: 'admin', expiresAt: 500 }, 200);
  await deleteSession(database, 'active');
  assert.equal(await findSession(database, 'active', 200), null);
});

test('opportunistic cleanup is rate limited without installing a timer', async () => {
  const database = new SessionDatabase();
  const originalSetInterval = globalThis.setInterval;
  let intervalCalls = 0;
  globalThis.setInterval = ((..._args: Parameters<typeof setInterval>) => {
    intervalCalls += 1;
    return 1 as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;

  try {
    await saveSession(database, 'one', { role: 'admin', expiresAt: 10_000 }, 1_000);
    await saveSession(database, 'two', { role: 'admin', expiresAt: 10_000 }, 1_001);
    await findSession(database, 'one', 1_002);
  } finally {
    globalThis.setInterval = originalSetInterval;
  }

  const cleanupQueries = database.queries.filter(({ text }) =>
    text.replace(/\s+/g, ' ').includes('DELETE FROM auth_sessions WHERE expires_at <= $1'));
  assert.equal(intervalCalls, 0);
  assert.equal(cleanupQueries.length, 1);
});
