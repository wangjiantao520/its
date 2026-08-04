import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';

import {
  deleteSession,
  deleteSessionsForUser,
  findSession,
  saveSession,
} from './auth-session-store';
import { getDatabase, type DatabaseClient } from './database/client';
import { getRequestSessionToken } from './request-session-token';

const PASSWORDS: Record<string, string | undefined> = {
  admin: process.env.ADMIN_PASSWORD || 'admin123',
};

const DEFAULT_ITS_USERS: Record<string, { password: string; name: string; userId: number }> = {
  demo: { password: 'demo123', name: '演示用户', userId: -101 },
  test: { password: 'test123', name: '测试账号', userId: -102 },
  its: { password: process.env.ITS_PASSWORD || 'its123', name: 'ITS成员', userId: -103 },
};

interface SessionUser {
  role: string;
  userId?: number;
  username?: string;
  name?: string;
}

interface CredentialRow extends Record<string, unknown> {
  id: string | number | bigint;
  password_hash: string;
  name: string | null;
  is_active: boolean;
  role: string;
}

interface ActiveUserRow extends Record<string, unknown> {
  is_active: boolean;
}

interface UserIdRow extends Record<string, unknown> {
  id: string | number | bigint;
}

interface UserListRow extends Record<string, unknown> {
  id: string | number | bigint;
  username: string;
  name: string | null;
  is_active: boolean;
  created_at: Date | string;
  created_by: string | null;
}

export interface PublicUser {
  id: number;
  username: string;
  name: string | null;
  is_active: 0 | 1;
  created_at: string;
  created_by: string | null;
}

function toSafeInteger(value: string | number | bigint, field: string): number {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER) || parsed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${field} exceeds JavaScript's safe integer range.`);
  }
  return Number(parsed);
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function validateAdminPassword(password: string): boolean {
  const expected = PASSWORDS.admin;
  if (!expected) {
    console.error('[Auth] 管理员密码未配置: 请设置环境变量 ADMIN_PASSWORD');
    return false;
  }
  if (expected === 'admin123' && process.env.NODE_ENV === 'production') {
    console.warn('[Auth] 警告：生产环境中正在使用默认密码！请设置环境变量 ADMIN_PASSWORD');
  }
  return password === expected;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function verifySession(
  request: NextRequest,
  database: DatabaseClient = getDatabase(),
): Promise<SessionUser | null> {
  const token = getRequestSessionToken(request);
  if (!token) return null;

  const session = await findSession(database, token);
  if (!session) return null;

  if (session.userId !== undefined && session.userId > 0) {
    const result = await database.query<ActiveUserRow>(
      'SELECT is_active FROM users WHERE id = $1',
      [session.userId],
    );
    const user = result.rows[0];
    if (!user?.is_active) {
      await deleteSession(database, token);
      return null;
    }
  }

  const defaultUser = session.username ? DEFAULT_ITS_USERS[session.username] : undefined;
  const userId = session.userId ?? defaultUser?.userId;

  return {
    role: session.role,
    ...(userId === undefined ? {} : { userId }),
    ...(session.username === undefined ? {} : { username: session.username }),
    ...(session.name === undefined ? {} : { name: session.name }),
  };
}

export async function getSessionUser(
  request: NextRequest,
  database: DatabaseClient = getDatabase(),
): Promise<SessionUser | null> {
  return verifySession(request, database);
}

async function validateUserCredentials(
  username: string,
  password: string,
  database: DatabaseClient,
): Promise<{ valid: boolean; userId?: number; name?: string }> {
  const defaultUser = DEFAULT_ITS_USERS[username];
  if (defaultUser) {
    return defaultUser.password === password
      ? { valid: true, userId: defaultUser.userId, name: defaultUser.name }
      : { valid: false };
  }

  const result = await database.query<CredentialRow>(
    'SELECT id, password_hash, name, is_active, role FROM users WHERE username = $1',
    [username],
  );
  const user = result.rows[0];
  if (!user?.is_active || user.role !== 'its_member') return { valid: false };
  if (!await bcrypt.compare(password, user.password_hash)) return { valid: false };

  return {
    valid: true,
    userId: toSafeInteger(user.id, 'users.id'),
    ...(user.name === null ? {} : { name: user.name }),
  };
}

export async function createUser(
  username: string,
  password: string,
  name: string,
  createdBy: string,
  database: DatabaseClient = getDatabase(),
): Promise<{ success: boolean; error?: string; userId?: number }> {
  try {
    const existing = await database.query<UserIdRow>(
      'SELECT id FROM users WHERE username = $1',
      [username],
    );
    if (existing.rows.length > 0) return { success: false, error: '用户名已存在' };

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await database.query<UserIdRow>(
      `INSERT INTO users (username, password_hash, name, role, created_by)
       VALUES ($1, $2, $3, 'its_member', $4) RETURNING id`,
      [username, passwordHash, name, createdBy],
    );
    const row = inserted.rows[0];
    if (!row) return { success: false, error: '创建用户失败' };

    return { success: true, userId: toSafeInteger(row.id, 'users.id') };
  } catch (error) {
    if (isUniqueViolation(error)) return { success: false, error: '用户名已存在' };
    console.error('创建用户失败:', error);
    return { success: false, error: '创建用户失败' };
  }
}

export async function getUsers(
  database: DatabaseClient = getDatabase(),
): Promise<PublicUser[]> {
  const result = await database.query<UserListRow>(
    `SELECT id, username, name, is_active, created_at, created_by FROM users
     ORDER BY created_at DESC`,
  );
  return result.rows.map((user) => ({
    id: toSafeInteger(user.id, 'users.id'),
    username: user.username,
    name: user.name,
    is_active: user.is_active ? 1 : 0,
    created_at: toIsoString(user.created_at),
    created_by: user.created_by,
  }));
}

export async function updateUser(
  userId: number,
  data: { name?: string; password?: string; is_active?: number },
  database: DatabaseClient = getDatabase(),
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: string[] = [];
    const values: Array<string | number | boolean> = [];
    if (data.name !== undefined) {
      values.push(data.name);
      updates.push(`name = $${values.length}`);
    }
    if (data.password !== undefined) {
      values.push(await bcrypt.hash(data.password, 10));
      updates.push(`password_hash = $${values.length}`);
    }
    if (data.is_active !== undefined) {
      values.push(data.is_active === 1);
      updates.push(`is_active = $${values.length}`);
    }

    if (updates.length === 0) {
      const existing = await database.query<UserIdRow>('SELECT id FROM users WHERE id = $1', [userId]);
      return existing.rows.length > 0
        ? { success: true }
        : { success: false, error: '用户不存在' };
    }

    return await database.transaction(async (client) => {
      values.push(userId);
      const updated = await client.query<UserIdRow>(
        `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP `
          + `WHERE id = $${values.length} RETURNING id`,
        values,
      );
      if (!updated.rows[0]) return { success: false, error: '用户不存在' };

      if (data.is_active === 0) await deleteSessionsForUser(client, userId);
      return { success: true };
    });
  } catch (error) {
    console.error('更新用户失败:', error);
    return { success: false, error: '更新用户失败' };
  }
}

export async function deleteUser(
  userId: number,
  database: DatabaseClient = getDatabase(),
): Promise<{ success: boolean; error?: string }> {
  try {
    return await database.transaction(async (client) => {
      await deleteSessionsForUser(client, userId);
      const deleted = await client.query<UserIdRow>(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [userId],
      );
      return deleted.rows[0]
        ? { success: true }
        : { success: false, error: '用户不存在' };
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    return { success: false, error: '删除用户失败' };
  }
}

export async function handleLogin(
  body: { role?: string; username?: string; password: string; remember?: boolean },
  database: DatabaseClient = getDatabase(),
): Promise<{
  success: boolean;
  error?: string;
  data?: {
    token: string;
    role: string;
    userId?: number;
    username?: string;
    name?: string;
    expiresAt: number;
  };
}> {
  try {
    const { role, username, password, remember } = body;
    const expiresIn = remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    if (role === 'admin') {
      if (!validateAdminPassword(password)) return { success: false, error: '密码错误' };

      const token = generateToken();
      const expiresAt = Date.now() + expiresIn;
      await saveSession(database, token, { role: 'admin', expiresAt });
      return { success: true, data: { token, role: 'admin', expiresAt } };
    }

    if (username) {
      const credential = await validateUserCredentials(username, password, database);
      if (!credential.valid) return { success: false, error: '用户名或密码错误' };

      const token = generateToken();
      const expiresAt = Date.now() + expiresIn;
      await saveSession(database, token, {
        role: 'its_member',
        userId: credential.userId !== undefined && credential.userId > 0
          ? credential.userId
          : undefined,
        username,
        name: credential.name,
        expiresAt,
      });
      return {
        success: true,
        data: {
          token,
          role: 'its_member',
          userId: credential.userId,
          username,
          name: credential.name,
          expiresAt,
        },
      };
    }

    return { success: false, error: '请提供用户名' };
  } catch (error) {
    console.error('登录失败:', error);
    return { success: false, error: '登录失败' };
  }
}

export async function handleLogout(
  request: NextRequest,
  database: DatabaseClient = getDatabase(),
): Promise<{ success: boolean; error?: string }> {
  const token = getRequestSessionToken(request);
  if (!token) return { success: false, error: '未登录' };

  await deleteSession(database, token);
  return { success: true };
}
