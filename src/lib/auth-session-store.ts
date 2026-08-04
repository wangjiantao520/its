import crypto from 'node:crypto';

import type { DatabaseClient } from './database/client';

export interface AuthSession {
  role: string;
  userId?: number;
  username?: string;
  name?: string;
  expiresAt: number;
}

interface AuthSessionRow extends Record<string, unknown> {
  role: string;
  user_id: string | number | bigint | null;
  username: string | null;
  name: string | null;
  expires_at: string | number | bigint;
}

const SESSION_CLEANUP_INTERVAL_MS = 60_000;
const lastCleanupByDatabase = new WeakMap<DatabaseClient, number>();

function toSafeInteger(value: string | number | bigint, field: string): number {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER) || parsed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${field} exceeds JavaScript's safe integer range.`);
  }
  return Number(parsed);
}

async function maybeCleanupExpiredSessions(
  database: DatabaseClient,
  now: number,
): Promise<void> {
  const lastCleanup = lastCleanupByDatabase.get(database);
  if (lastCleanup !== undefined && now - lastCleanup < SESSION_CLEANUP_INTERVAL_MS) return;

  lastCleanupByDatabase.set(database, now);
  await cleanupExpiredSessions(database, now);
}

export function hashAuthToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function saveSession(
  database: DatabaseClient,
  token: string,
  session: AuthSession,
  now = Date.now(),
): Promise<void> {
  await maybeCleanupExpiredSessions(database, now);
  await database.query(`
    INSERT INTO auth_sessions
      (token_hash, role, user_id, username, name, expires_at, last_seen_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT(token_hash) DO UPDATE SET
      role = EXCLUDED.role,
      user_id = EXCLUDED.user_id,
      username = EXCLUDED.username,
      name = EXCLUDED.name,
      expires_at = EXCLUDED.expires_at,
      last_seen_at = CURRENT_TIMESTAMP
  `, [
    hashAuthToken(token),
    session.role,
    session.userId ?? null,
    session.username ?? null,
    session.name ?? null,
    session.expiresAt,
  ]);
}

export async function findSession(
  database: DatabaseClient,
  token: string,
  now = Date.now(),
): Promise<AuthSession | null> {
  await maybeCleanupExpiredSessions(database, now);
  const tokenHash = hashAuthToken(token);
  const result = await database.query<AuthSessionRow>(
    'SELECT role, user_id, username, name, expires_at FROM auth_sessions WHERE token_hash = $1',
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;

  const expiresAt = toSafeInteger(row.expires_at, 'auth_sessions.expires_at');
  if (expiresAt <= now) {
    await database.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
    return null;
  }

  await database.query(
    'UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
    [tokenHash],
  );

  return {
    role: row.role,
    ...(row.user_id === null ? {} : { userId: toSafeInteger(row.user_id, 'auth_sessions.user_id') }),
    ...(row.username === null ? {} : { username: row.username }),
    ...(row.name === null ? {} : { name: row.name }),
    expiresAt,
  };
}

export async function deleteSession(database: DatabaseClient, token: string): Promise<void> {
  await database.query(
    'DELETE FROM auth_sessions WHERE token_hash = $1',
    [hashAuthToken(token)],
  );
}

export async function deleteSessionsForUser(
  database: DatabaseClient,
  userId: number,
): Promise<number> {
  const result = await database.query(
    'DELETE FROM auth_sessions WHERE user_id = $1',
    [userId],
  );
  return result.rowCount;
}

export async function cleanupExpiredSessions(
  database: DatabaseClient,
  now = Date.now(),
): Promise<number> {
  const result = await database.query(
    'DELETE FROM auth_sessions WHERE expires_at <= $1',
    [now],
  );
  return result.rowCount;
}
