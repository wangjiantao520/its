import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export interface AuthSession {
  role: string;
  userId?: number;
  username?: string;
  name?: string;
  expiresAt: number;
}

interface AuthSessionRow {
  role: string;
  user_id: number | null;
  username: string | null;
  name: string | null;
  expires_at: number;
}

export function hashAuthToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createAuthSession(
  database: Database.Database,
  token: string,
  session: AuthSession,
): void {
  database
    .prepare(`
      INSERT INTO auth_sessions
        (token_hash, role, user_id, username, name, expires_at, last_seen_at)
      VALUES
        (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(token_hash) DO UPDATE SET
        role = excluded.role,
        user_id = excluded.user_id,
        username = excluded.username,
        name = excluded.name,
        expires_at = excluded.expires_at,
        last_seen_at = CURRENT_TIMESTAMP
    `)
    .run(
      hashAuthToken(token),
      session.role,
      session.userId ?? null,
      session.username ?? null,
      session.name ?? null,
      session.expiresAt,
    );
}

export function findAuthSession(
  database: Database.Database,
  token: string,
  now = Date.now(),
): AuthSession | null {
  const tokenHash = hashAuthToken(token);
  const row = database
    .prepare(`
      SELECT role, user_id, username, name, expires_at
      FROM auth_sessions
      WHERE token_hash = ?
    `)
    .get(tokenHash) as AuthSessionRow | undefined;

  if (!row) return null;
  if (row.expires_at <= now) {
    database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  database
    .prepare('UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?')
    .run(tokenHash);

  return {
    role: row.role,
    ...(row.user_id === null ? {} : { userId: row.user_id }),
    ...(row.username === null ? {} : { username: row.username }),
    ...(row.name === null ? {} : { name: row.name }),
    expiresAt: row.expires_at,
  };
}

export function deleteAuthSession(database: Database.Database, token: string): void {
  database
    .prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
    .run(hashAuthToken(token));
}

export function deleteAuthSessionsForUser(
  database: Database.Database,
  userId: number,
): number {
  return database.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId).changes;
}

export function cleanupExpiredAuthSessions(
  database: Database.Database,
  now = Date.now(),
): number {
  return database.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now).changes;
}
