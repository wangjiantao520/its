import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from './db';

// 密码配置（从环境变量读取）
const PASSWORDS: Record<string, string | undefined> = {
  'admin': process.env.ADMIN_PASSWORD,
};

// 默认ITS账号（无需数据库，用于演示和测试）
const DEFAULT_ITS_USERS: Record<string, { password: string; name: string }> = {
  'demo': { password: 'demo123', name: '演示用户' },
  'test': { password: 'test123', name: '测试账号' },
};

// 验证管理员密码
function validateAdminPassword(password: string): boolean {
  const expected = PASSWORDS['admin'];
  if (!expected) {
    console.error('[Auth] 管理员密码未配置: 请设置环境变量 ADMIN_PASSWORD');
    return false;
  }
  return password === expected;
}

// 会话数据结构
interface SessionData {
  role: string;
  userId?: number;
  username?: string;
  name?: string;  // 真实姓名
  expiresAt: number;
}

// 使用 globalThis 持久化会话存储
const getSessions = (): Map<string, SessionData> => {
  if (!(globalThis as any).__authSessions) {
    (globalThis as any).__authSessions = new Map<string, SessionData>();
  }
  return (globalThis as any).__authSessions;
};

// 生成会话token
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// 清理过期会话
function cleanupExpiredSessions() {
  const sessions = getSessions();
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
}

// 定期清理过期会话
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredSessions, 60000);
}

// 验证会话
export function verifySession(request: NextRequest): { role: string; userId?: number; username?: string; name?: string } | null {
  const sessions = getSessions();
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return { role: session.role, userId: session.userId, username: session.username, name: session.name };
}

// 获取会话中的用户信息
export function getSessionUser(request: NextRequest): { role: string; userId?: number; username?: string; name?: string } | null {
  return verifySession(request);
}

// 验证ITS成员用户名密码（先检查默认账号，再检查数据库）
async function validateUserCredentials(username: string, password: string): Promise<{ valid: boolean; userId?: number; name?: string }> {
  // 1. 先检查默认账号
  const defaultUser = DEFAULT_ITS_USERS[username];
  if (defaultUser) {
    if (defaultUser.password === password) {
      return { valid: true, userId: -1, name: defaultUser.name }; // userId=-1 表示默认账号
    }
    return { valid: false };
  }

  // 2. 检查数据库（如果数据库可用）
  try {
    const [rows] = await pool.execute(
      'SELECT id, password_hash, name, is_active FROM users WHERE username = ?',
      [username]
    ) as [any[], any];

    if (!rows || rows.length === 0) {
      return { valid: false };
    }

    const user = rows[0];

    // 检查账号是否启用
    if (!user.is_active) {
      return { valid: false };
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return { valid: false };
    }

    return { valid: true, userId: user.id, name: user.name };
  } catch (error) {
    console.error('数据库验证失败:', error);
    // 数据库不可用时，只用默认账号
    return { valid: false };
  }
}

// 创建用户（加密密码）
export async function createUser(username: string, password: string, name: string, createdBy: string): Promise<{ success: boolean; error?: string; userId?: number }> {
  try {
    // 检查用户名是否已存在
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]) as [any[], any];
    if (existing && existing.length > 0) {
      return { success: false, error: '用户名已存在' };
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 插入用户
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, name, created_by) VALUES (?, ?, ?, ?)',
      [username, passwordHash, name, createdBy]
    ) as [any, any];

    return { success: true, userId: result.insertId };
  } catch (error) {
    console.error('创建用户失败:', error);
    return { success: false, error: '创建用户失败' };
  }
}

// 获取用户列表
export async function getUsers(): Promise<any[]> {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, name, is_active, created_at, created_by FROM users ORDER BY created_at DESC'
    ) as [any[], any];
    return rows || [];
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }
}

// 更新用户
export async function updateUser(userId: number, data: { name?: string; password?: string; is_active?: number }): Promise<{ success: boolean; error?: string }> {
  try {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.password !== undefined) {
      updates.push('password_hash = ?');
      values.push(data.password);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      return { success: true };
    }

    values.push(userId);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    return { success: true };
  } catch (error) {
    console.error('更新用户失败:', error);
    return { success: false, error: '更新用户失败' };
  }
}

// 删除用户
export async function deleteUser(userId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    return { success: true };
  } catch (error) {
    console.error('删除用户失败:', error);
    return { success: false, error: '删除用户失败' };
  }
}

// 登录处理
export async function handleLogin(body: { role?: string; username?: string; password: string; remember?: boolean }): Promise<{
  success: boolean;
  error?: string;
  data?: { token: string; role: string; userId?: number; username?: string; name?: string; expiresAt: number };
}> {
  try {
    const { role, username, password, remember } = body;

    // 计算过期时间：记住我=7天，否则=24小时
    const expiresIn = remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    // 管理员登录（角色+密码）
    if (role === 'admin') {
      if (!validateAdminPassword(password)) {
        return { success: false, error: '密码错误' };
      }

      const token = generateToken();
      const expiresAt = Date.now() + expiresIn;

      const sessions = getSessions();
      sessions.set(token, { role: 'admin', expiresAt });

      return {
        success: true,
        data: { token, role: 'admin', expiresAt }
      };
    }

    // ITS成员登录（用户名+密码）
    if (username) {
      const result = await validateUserCredentials(username, password);
      if (!result.valid) {
        return { success: false, error: '用户名或密码错误' };
      }

      const token = generateToken();
      const expiresAt = Date.now() + expiresIn;

      const sessions = getSessions();
      sessions.set(token, { role: 'its_member', userId: result.userId, username, name: result.name, expiresAt });

      return {
        success: true,
        data: { token, role: 'its_member', userId: result.userId, username, name: result.name, expiresAt }
      };
    }

    return { success: false, error: '请提供用户名' };
  } catch (error) {
    console.error('登录失败:', error);
    return { success: false, error: '登录失败' };
  }
}

// 登出处理
export function handleLogout(request: NextRequest): { success: boolean; error?: string } {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: '未登录' };
  }

  const token = authHeader.substring(7);
  const sessions = getSessions();
  sessions.delete(token);

  return { success: true };
}
