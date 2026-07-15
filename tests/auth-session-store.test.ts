import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { runDatabaseMigrations } from '../src/lib/database/migrations';
import {
  createAuthSession,
  deleteAuthSession,
  deleteAuthSessionsForUser,
  findAuthSession,
  hashAuthToken,
} from '../src/lib/auth-session-store';

function createDatabase(): Database.Database {
  const database = new Database(':memory:');
  runDatabaseMigrations(database, ':memory:');
  return database;
}

test('stores only a token hash and restores an unexpired session', () => {
  const database = createDatabase();
  try {
    const token = 'plain-secret-token';
    createAuthSession(database, token, {
      role: 'its_member',
      userId: 7,
      username: 'member',
      name: '成员',
      expiresAt: 2_000,
    });

    const stored = database
      .prepare('SELECT token_hash FROM auth_sessions')
      .get() as { token_hash: string };
    assert.equal(stored.token_hash, hashAuthToken(token));
    assert.notEqual(stored.token_hash, token);
    assert.deepEqual(findAuthSession(database, token, 1_000), {
      role: 'its_member',
      userId: 7,
      username: 'member',
      name: '成员',
      expiresAt: 2_000,
    });
  } finally {
    database.close();
  }
});

test('revokes every active session for a database user', () => {
  const database = createDatabase();
  try {
    createAuthSession(database, 'first-device', {
      role: 'its_member', userId: 9, expiresAt: 500,
    });
    createAuthSession(database, 'second-device', {
      role: 'its_member', userId: 9, expiresAt: 500,
    });
    createAuthSession(database, 'another-user', {
      role: 'its_member', userId: 10, expiresAt: 500,
    });

    assert.equal(deleteAuthSessionsForUser(database, 9), 2);
    assert.equal(findAuthSession(database, 'first-device', 200), null);
    assert.equal(findAuthSession(database, 'second-device', 200), null);
    assert.notEqual(findAuthSession(database, 'another-user', 200), null);
  } finally {
    database.close();
  }
});

test('expired and revoked sessions cannot be restored', () => {
  const database = createDatabase();
  try {
    createAuthSession(database, 'expired', { role: 'admin', expiresAt: 100 });
    assert.equal(findAuthSession(database, 'expired', 101), null);
    assert.deepEqual(
      database.prepare('SELECT COUNT(*) AS count FROM auth_sessions').get(),
      { count: 0 },
    );

    createAuthSession(database, 'active', { role: 'admin', expiresAt: 500 });
    deleteAuthSession(database, 'active');
    assert.equal(findAuthSession(database, 'active', 200), null);
  } finally {
    database.close();
  }
});
