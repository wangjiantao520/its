import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 密码配置（从环境变量读取，生产环境必须设置）
const PASSWORDS: Record<string, string | undefined> = {
  'admin': process.env.ADMIN_PASSWORD,
  'its_member': process.env.ITS_PASSWORD
};

// 验证密码 - 环境变量必须设置
function validatePassword(role: string, password: string): boolean {
  const expected = PASSWORDS[role];
  if (!expected) {
    console.error(`[Auth] 密码未配置: 请设置环境变量 ${role === 'admin' ? 'ADMIN_PASSWORD' : 'ITS_PASSWORD'}`);
    return false;
  }
  return password === expected;
}

// 使用 globalThis 持久化会话存储
const getSessions = (): Map<string, { role: string; expiresAt: number }> => {
  if (!globalThis.__authSessions) {
    (globalThis as any).__authSessions = new Map();
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
export function verifySession(request: NextRequest): { role: string } | null {
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

  return { role: session.role };
}

// 获取会话中的用户信息
export function getSessionUser(request: NextRequest): { role: string } | null {
  return verifySession(request);
}

// 登录处理
export async function handleLogin(body: { role: string; password: string }): Promise<{
  success: boolean;
  error?: string;
  data?: { token: string; role: string; expiresAt: number };
}> {
  try {
    const { role, password } = body;

    if (!role || !password) {
      return { success: false, error: '请提供角色和密码' };
    }

    // 验证角色
    if (role !== 'admin' && role !== 'its_member') {
      return { success: false, error: '无效的角色' };
    }

    // 验证密码
    if (!validatePassword(role, password)) {
      return { success: false, error: '密码错误' };
    }

    // 生成会话token
    const token = generateToken();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24小时过期

    // 存储会话
    const sessions = getSessions();
    sessions.set(token, { role, expiresAt });

    return {
      success: true,
      data: { token, role, expiresAt }
    };
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
