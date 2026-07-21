'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, UserRole } from '@/lib/roles';
import { readApiResponse } from '@/lib/api-response';
import { verifySessionToken } from '@/lib/session-verification';

interface AuthResponse {
  token: string;
  role: UserRole;
  userId?: number;
  username?: string;
  name?: string;
  expiresAt: number;
}

interface UserContextType {
  user: User | null;
  isLoggedIn: boolean;
  token: string | null;
  login: (role: UserRole, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setUserRole: (role: UserRole) => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// 创建用户对象
function createUser(role: UserRole, token?: string, name?: string, username?: string): User {
  return {
    id: token || `user-${Date.now()}`,
    name: name || (role === 'admin' ? '系统管理员' : 'ITS成员'),
    role: role,
    username: username
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  // 初始为 true，客户端 useEffect 中同步读取 localStorage 后立即置为 false
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：同步读取本地会话，立即结束加载状态，然后异步验证服务端会话
  useEffect(() => {
    let cancelled = false;

    const savedToken = localStorage.getItem('authToken');
    const savedRole = localStorage.getItem('userRole') as UserRole | null;
    const savedName = localStorage.getItem('itsName');
    const savedUsername = localStorage.getItem('itsUsername');

    // 没有本地 token：立即结束加载，未登录状态
    if (!savedToken || !savedRole) {
      setIsLoading(false);
      return;
    }

    // 有本地 token：先乐观设置为已登录（立即结束加载，用户能看到页面）
    setToken(savedToken);
    setUser(createUser(savedRole, savedToken, savedName || undefined, savedUsername || undefined));
    setIsLoggedIn(true);
    setIsLoading(false);

    // 后台异步验证服务端会话
    const verifyAsync = async () => {
      try {
        const verification = await verifySessionToken(savedToken);
        if (cancelled) return;

        if (verification.status === 'invalid') {
          // 服务端会话已失效，清除本地状态
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          localStorage.removeItem('itsName');
          localStorage.removeItem('itsUsername');
          setToken(null);
          setUser(null);
          setIsLoggedIn(false);
          // 跳转登录页
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        } else if (verification.status === 'valid') {
          const { role, name, username } = verification.user;
          localStorage.setItem('userRole', role);
          setUser(createUser(role, savedToken, name, username));
        } else {
          // 网络超时或服务临时错误时保留本地会话；后续业务 API 仍会独立鉴权。
          console.warn('[UserContext] 会话验证暂时不可用:', verification.error);
        }
      } catch (err) {
        // 验证失败不影响已显示的内容（网络问题等）
        console.warn('验证会话失败:', err);
      }
    };

    void verifyAsync();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (role: UserRole, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role, password })
      });

      const data = await readApiResponse<AuthResponse>(response);
      if (!response.ok || !data.success || !data.data) {
        return { success: false, error: data.error || '登录失败' };
      }

      const authData = data.data;

      // 存储到本地
      localStorage.setItem('authToken', authData.token);
      localStorage.setItem('userRole', role);

      // 存储会话信息
      setToken(authData.token);
      setUser(createUser(role, authData.token));
      setIsLoggedIn(true);

      return { success: true };
    } catch (error) {
      console.error('登录失败:', error);
      return { success: false, error: '网络错误，请重试' };
    }
  }, []);

  const logout = useCallback(async () => {
    // 尝试通知服务器使会话失效
    if (token) {
      try {
        await fetch('/api/auth', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch {
        // 忽略错误，即使服务器端删除失败也清除本地状态
      }
    }

    // 清除本地存储
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('itsName');
    localStorage.removeItem('itsUsername');
    localStorage.removeItem('rememberLogin');

    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
  }, [token]);

  const setUserRole = useCallback((role: UserRole) => {
    if (user) {
      const newUser = { ...user, role };
      setUser(newUser);
      localStorage.setItem('userRole', role);
    }
  }, [user]);

  return (
    <UserContext.Provider value={{ user, isLoggedIn, token, login, logout, setUserRole, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// 获取用于API请求的认证头
export function getAuthHeader(token: string | null): HeadersInit {
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
