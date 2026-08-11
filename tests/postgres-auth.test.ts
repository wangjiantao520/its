import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

import {
  createUser,
  deleteUser,
  getUsers,
  handleLogin,
  handleLogout,
  updateUser,
  verifySession,
} from '../src/lib/auth';
import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { runPostgresMigrations } from '../src/lib/database/postgres-migrations';
import { hashAuthToken, saveSession } from '../src/lib/auth-session-store';
import { SESSION_COOKIE_NAME } from '../src/lib/request-session-token';
import {
  createPostgresTestHarness,
  POSTGRES_TEST_SKIP_REASON,
} from './helpers/postgres';

type QueryHandler = (
  text: string,
  params: readonly unknown[],
) => QueryResult<Record<string, unknown>> | Promise<QueryResult<Record<string, unknown>>>;

class FakeDatabase implements DatabaseClient {
  readonly queries: Array<{ text: string; params: readonly unknown[] }> = [];

  constructor(private readonly handler: QueryHandler) {}

  async query<Row extends Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ text, params });
    return await this.handler(text, params) as QueryResult<Row>;
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

function result(rows: Array<Record<string, unknown>> = [], rowCount = rows.length) {
  return { rows, rowCount };
}

function bearerRequest(token: string): NextRequest {
  return new NextRequest('http://localhost/api/auth', {
    headers: { authorization: `Bearer ${token}` },
  });
}

test('administrator and built-in member login persist hashed PostgreSQL sessions', async () => {
  const database = new FakeDatabase((text, params) => {
    if (text.includes('DELETE FROM auth_sessions WHERE expires_at')) return result();
    if (text.includes('SELECT id, password_hash, name, is_active, role FROM users WHERE username')) {
      return result([{ id: '12', password_hash: bcrypt.hashSync('admin123', 4), name: '管理员', is_active: true, role: 'admin' }]);
    }
    if (text.includes('SELECT id FROM users WHERE username')) return result([{ id: '42' }]);
    if (text.includes('INSERT INTO auth_sessions')) {
      if (Number(params[2]) < 0) {
        throw Object.assign(new Error('foreign key violation'), { code: '23503' });
      }
      return result([], 1);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });

  const admin = await handleLogin({ role: 'admin', password: 'admin123' }, database);
  const member = await handleLogin({ username: 'demo', password: 'demo123' }, database);

  assert.equal(admin.success, true);
  assert.equal(admin.data?.role, 'admin');
  assert.equal(admin.data?.username, 'admin');
  assert.equal(member.success, true);
  assert.deepEqual(
    { role: member.data?.role, userId: member.data?.userId, username: member.data?.username },
    { role: 'its_member', userId: 42, username: 'demo' },
  );
  const inserts = database.queries.filter(({ text }) => text.includes('INSERT INTO auth_sessions'));
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].params[0], hashAuthToken(admin.data?.token ?? ''));
  assert.equal(inserts[1].params[0], hashAuthToken(member.data?.token ?? ''));
  assert.equal(inserts[1].params[2], 42);
  assert.ok(inserts.every(({ text }) => text.includes('$1') && !text.includes('?')));
});

test('database member login accepts bcrypt passwords and rejects wrong or disabled accounts', async () => {
  const passwordHash = await bcrypt.hash('secret123', 4);
  let active = true;
  const database = new FakeDatabase((text) => {
    if (text.includes('SELECT id, password_hash, name, is_active, role FROM users')) {
      return result([{ id: '42', password_hash: passwordHash, name: '成员甲', is_active: active, role: 'its_member' }]);
    }
    if (text.includes('DELETE FROM auth_sessions WHERE expires_at')) return result();
    if (text.includes('INSERT INTO auth_sessions')) return result([], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });

  const successful = await handleLogin({ username: 'member-a', password: 'secret123' }, database);
  const wrongPassword = await handleLogin({ username: 'member-a', password: 'wrong' }, database);
  active = false;
  const disabled = await handleLogin({ username: 'member-a', password: 'secret123' }, database);

  assert.equal(successful.success, true);
  assert.equal(successful.data?.userId, 42);
  assert.deepEqual(wrongPassword, { success: false, error: '用户名或密码错误' });
  assert.deepEqual(disabled, { success: false, error: '用户名或密码错误' });
});

test('missing, expired, disabled, and deleted users have no valid session', async () => {
  const sessions = new Map<string, Record<string, unknown>>();
  let userActive: boolean | null = true;
  const database = new FakeDatabase((text, params) => {
    if (text.includes('DELETE FROM auth_sessions WHERE expires_at')) return result();
    if (text.includes('INSERT INTO auth_sessions')) {
      sessions.set(String(params[0]), {
        role: params[1], user_id: params[2], username: params[3], name: params[4], expires_at: params[5],
      });
      return result([], 1);
    }
    if (text.includes('SELECT role, user_id, username, name, expires_at FROM auth_sessions')) {
      const row = sessions.get(String(params[0]));
      return result(row ? [row] : []);
    }
    if (text.includes('UPDATE auth_sessions SET last_seen_at')) return result([], 1);
    if (text.includes('SELECT id, name FROM users WHERE username')) {
      return result([{ id: '42', name: '演示用户' }]);
    }
    if (text.includes('SELECT is_active FROM users')) {
      return result(userActive === null ? [] : [{ is_active: userActive }]);
    }
    if (text.includes('DELETE FROM auth_sessions WHERE token_hash')) {
      const deleted = sessions.delete(String(params[0]));
      return result([], deleted ? 1 : 0);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });

  assert.equal(await verifySession(bearerRequest('missing'), database), null);
  await saveSession(database, 'expired', { role: 'admin', expiresAt: 1 }, 0);
  assert.equal(await verifySession(bearerRequest('expired'), database), null);

  await saveSession(database, 'member', {
    role: 'its_member', userId: 7, username: 'member', expiresAt: Date.now() + 60_000,
  });
  assert.equal((await verifySession(bearerRequest('member'), database))?.userId, 7);
  userActive = false;
  assert.equal(await verifySession(bearerRequest('member'), database), null);

  await saveSession(database, 'deleted', {
    role: 'its_member', userId: 8, username: 'deleted', expiresAt: Date.now() + 60_000,
  });
  userActive = null;
  assert.equal(await verifySession(bearerRequest('deleted'), database), null);

  await saveSession(database, 'built-in', {
    role: 'its_member', username: 'demo', name: '演示用户', expiresAt: Date.now() + 60_000,
  });
  assert.equal((await verifySession(bearerRequest('built-in'), database))?.userId, 42);
});

test('logout revokes the bearer session and missing logout is rejected', async () => {
  const database = new FakeDatabase((text) => {
    if (text.includes('DELETE FROM auth_sessions WHERE token_hash')) return result([], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });

  assert.deepEqual(await handleLogout(bearerRequest('logout-token'), database), { success: true });
  assert.deepEqual(
    await handleLogout(new NextRequest('http://localhost/api/auth'), database),
    { success: false, error: '未登录' },
  );
  assert.equal(database.queries[0].params[0], hashAuthToken('logout-token'));
});

test('user CRUD uses parameterized PostgreSQL and never exposes password hashes', async () => {
  const passwordHash = await bcrypt.hash('password1', 4);
  let insertedHash = '';
  const database = new FakeDatabase((text, params) => {
    if (text.startsWith('SELECT id FROM users WHERE username')) return result();
    if (text.startsWith('INSERT INTO users')) {
      insertedHash = String(params[1]);
      return result([{ id: '900719' }], 1);
    }
    if (text.includes('SELECT id, username, name, role, is_active, created_at, created_by FROM users')) {
      return result([{
        id: '900719', username: 'new-user', name: null, role: 'its_member', is_active: true,
        created_at: new Date('2026-08-04T00:00:00.000Z'), created_by: null,
        password_hash: passwordHash,
      }]);
    }
    if (text.includes('SELECT role, is_active FROM users WHERE id')) return result([{ role: 'its_member', is_active: true }]);
    if (text.includes('SELECT role FROM users WHERE id')) return result([{ role: 'its_member' }]);
    if (text.startsWith('UPDATE users SET')) return result([{ id: '900719' }], 1);
    if (text.includes('DELETE FROM auth_sessions WHERE user_id')) return result([], 2);
    if (text.startsWith('DELETE FROM users')) return result([{ id: '900719' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });

  const created = await createUser('new-user', 'password1', '新用户', 'admin', 'its_member', database);
  assert.deepEqual(created, { success: true, userId: 900719 });
  assert.equal(await bcrypt.compare('password1', insertedHash), true);

  const users = await getUsers(database);
  assert.deepEqual(users, [{
    id: 900719,
    username: 'new-user',
    name: null,
    role: 'its_member',
    is_active: 1,
    created_at: '2026-08-04T00:00:00.000Z',
    created_by: null,
  }]);
  assert.equal('password_hash' in users[0], false);

  assert.deepEqual(await updateUser(900719, { name: '新姓名', is_active: 0 }, database), { success: true });
  assert.deepEqual(await deleteUser(900719, database), { success: true });
  assert.ok(database.queries.every(({ text }) => !text.includes('?')));
});

test('user CRUD reports duplicate and missing users explicitly', async () => {
  const database = new FakeDatabase((text) => {
    if (text.startsWith('SELECT id FROM users WHERE username')) return result([{ id: '3' }]);
    if (text.includes('SELECT role, is_active FROM users WHERE id')) return result();
    if (text.includes('SELECT role FROM users WHERE id')) return result();
    if (text.startsWith('UPDATE users SET')) return result();
    if (text.startsWith('DELETE FROM users')) return result();
    if (text.includes('DELETE FROM auth_sessions WHERE user_id')) return result();
    throw new Error(`Unexpected SQL: ${text}`);
  });

  assert.deepEqual(
    await createUser('duplicate', 'password1', '重复', 'admin', 'its_member', database),
    { success: false, error: '用户名已存在' },
  );
  assert.deepEqual(
    await updateUser(404, { name: '不存在' }, database),
    { success: false, error: '用户不存在' },
  );
  assert.deepEqual(await deleteUser(404, database), { success: false, error: '用户不存在' });
});

test('session cookie name remains compatible with the frontend', () => {
  assert.equal(SESSION_COOKIE_NAME, 'session_token');
});

test('live PostgreSQL authentication and user persistence', {
  skip: process.env.TEST_DATABASE_URL ? false : POSTGRES_TEST_SKIP_REASON,
}, async (t) => {
  const harness = await createPostgresTestHarness(t);
  await runPostgresMigrations(harness.client);

  const created = await createUser('live-member', 'live-password', '集成测试成员', 'admin', 'its_member', harness.client);
  assert.equal(created.success, true);
  assert.ok(created.userId);

  const login = await handleLogin({ username: 'live-member', password: 'live-password' }, harness.client);
  assert.equal(login.success, true);
  assert.equal(login.data?.userId, created.userId);
  assert.equal((await verifySession(bearerRequest(login.data?.token ?? ''), harness.client))?.username, 'live-member');

  const users = await getUsers(harness.client);
  assert.equal(users.some(({ username }) => username === 'live-member'), true);
  assert.equal(users.some((user) => 'password_hash' in user), false);
});
