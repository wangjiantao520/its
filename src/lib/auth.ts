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

interface BuiltinMember {
  password?: string;
  passwordEnv?: string;
  fallback?: string;
  name: string;
}

const BUILTIN_MEMBERS: Record<string, BuiltinMember> = {
  demo: { password: 'demo123', name: '演示用户' },
  test: { password: 'test123', name: '测试账号' },
  its: { passwordEnv: 'ITS_PASSWORD', fallback: 'its123', name: 'ITS成员' },
};

function builtinPassword(member: BuiltinMember): string {
  if (member.passwordEnv && process.env[member.passwordEnv]) return process.env[member.passwordEnv] as string;
  return member.password ?? member.fallback ?? '';
}

async function resolveOrCreateUser(
  username: string,
  password: string,
  name: string,
  role: string,
  database: DatabaseClient,
): Promise<number> {
  const existing = await database.query<UserIdRow>(
    'SELECT id FROM users WHERE username = $1',
    [username],
  );
  if (existing.rows[0]) return toSafeInteger(existing.rows[0].id, 'users.id');

  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = await database.query<UserIdRow>(
    `INSERT INTO users (username, password_hash, name, role, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [username, passwordHash, name, role, 'auth'],
  );
  const row = inserted.rows[0];
  if (!row) throw new Error(`创建用户失败: ${username}`);
  return toSafeInteger(row.id, 'users.id');
}

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
  role: string;
  is_active: boolean;
  created_at: Date | string;
  created_by: string | null;
}

export interface PublicUser {
  id: number;
  username: string;
  name: string | null;
  role: string;
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

  let userId = session.userId;
  if (userId === undefined || userId <= 0) {
    if (session.username) {
      const user = await database.query<UserIdRow & { name: string | null }>(
        'SELECT id, name FROM users WHERE username = $1',
        [session.username],
      );
      if (!user.rows[0]) {
        await deleteSession(database, token);
        return null;
      }
      userId = toSafeInteger(user.rows[0].id, 'users.id');
    }
  }

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
  const builtin = BUILTIN_MEMBERS[username];
  if (builtin) {
    const expectedPassword = builtinPassword(builtin);
    if (expectedPassword !== password) return { valid: false };
    const userId = await resolveOrCreateUser(username, expectedPassword, builtin.name, 'its_member', database);
    return { valid: true, userId, name: builtin.name };
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
  role: 'admin' | 'its_member' = 'its_member',
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
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [username, passwordHash, name, role, createdBy],
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
    `SELECT id, username, name, role, is_active, created_at, created_by FROM users
     ORDER BY created_at DESC`,
  );
  return result.rows.map((user) => ({
    id: toSafeInteger(user.id, 'users.id'),
    username: user.username,
    name: user.name,
    role: user.role,
    is_active: user.is_active ? 1 : 0,
    created_at: toIsoString(user.created_at),
    created_by: user.created_by,
  }));
}

interface ActiveAdminRow extends Record<string, unknown> {
  cnt: string | number;
}

async function countActiveAdmins(database: DatabaseClient): Promise<number> {
  const result = await database.query<ActiveAdminRow>(
    "SELECT COUNT(*)::text AS cnt FROM users WHERE role = 'admin' AND is_active = true",
  );
  return Number(result.rows[0]?.cnt ?? 0);
}

export async function updateUser(
  userId: number,
  data: { name?: string; password?: string; is_active?: number; role?: 'admin' | 'its_member' },
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
    if (data.role !== undefined) {
      values.push(data.role);
      updates.push(`role = $${values.length}`);
    }

    if (updates.length === 0) {
      const existing = await database.query<UserIdRow>('SELECT id FROM users WHERE id = $1', [userId]);
      return existing.rows.length > 0
        ? { success: true }
        : { success: false, error: '用户不存在' };
    }

    return await database.transaction(async (client) => {
      // 防呆：若禁用/降级最后一个启用管理员，拒绝操作
      const target = await client.query<{ role: string; is_active: boolean }>(
        'SELECT role, is_active FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      );
      if (!target.rows[0]) return { success: false, error: '用户不存在' };
      const currentRole = target.rows[0].role;
      const willDisable = data.is_active === 0;
      const willDemote = data.role === 'its_member' && currentRole === 'admin';
      if (currentRole === 'admin' && (willDisable || willDemote)) {
        const activeAdmins = await countActiveAdmins(client);
        if (activeAdmins <= 1) {
          return { success: false, error: '不能禁用或降级最后一个管理员账号' };
        }
      }

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
      const target = await client.query<{ role: string }>(
        'SELECT role FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      );
      if (!target.rows[0]) return { success: false, error: '用户不存在' };
      if (target.rows[0].role === 'admin') {
        const activeAdmins = await countActiveAdmins(client);
        if (activeAdmins <= 1) {
          return { success: false, error: '不能删除最后一个管理员账号' };
        }
      }
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
      // 管理员登录优先查数据库（支持多个管理员账号），无匹配时回退环境变量
      const adminUsername = username || 'admin';
      const dbUser = await database.query<CredentialRow>(
        'SELECT id, password_hash, name, is_active, role FROM users WHERE username = $1',
        [adminUsername],
      );
      const row = dbUser.rows[0];

      let adminUserId: number;
      let adminName = '管理员';

      if (row) {
        if (row.role !== 'admin') return { success: false, error: '该账号不是管理员' };
        if (!row.is_active) return { success: false, error: '账号已禁用' };
        if (await bcrypt.compare(password, row.password_hash)) {
          adminUserId = toSafeInteger(row.id, 'users.id');
          if (row.name) adminName = row.name;
        } else if (validateAdminPassword(password)) {
          // 数据库管理员密码哈希失配：回退环境变量密码，并重置该账号哈希
          adminUserId = toSafeInteger(row.id, 'users.id');
          if (row.name) adminName = row.name;
          await database.query(
            'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
            [await bcrypt.hash(PASSWORDS.admin as string, 10), adminUserId],
          );
        } else {
          return { success: false, error: '密码错误' };
        }
      } else {
        // 数据库无此用户：回退环境变量 ADMIN_PASSWORD，并落库为 admin（迁移旧账号）
        if (!validateAdminPassword(password)) return { success: false, error: '密码错误' };
        adminUserId = await resolveOrCreateUser(adminUsername, PASSWORDS.admin as string, adminName, 'admin', database);
      }

      const token = generateToken();
      const expiresAt = Date.now() + expiresIn;
      await saveSession(database, token, { role: 'admin', userId: adminUserId, username: adminUsername, name: adminName, expiresAt });
      return { success: true, data: { token, role: 'admin', userId: adminUserId, username: adminUsername, name: adminName, expiresAt } };
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
