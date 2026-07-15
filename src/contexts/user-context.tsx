'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, UserRole } from '@/lib/roles';
import { readApiResponse, type ApiResponse } from '@/lib/api-response';

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

// 存储会话到服务端
async function verifyTokenOnServer(token: string): Promise<{ role: UserRole; name?: string; username?: string } | null> {
  try {
    const response = await fetch('/api/auth', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await readApiResponse(response) as ApiResponse<{
        role: UserRole;
        name?: string;
        username?: string;
      }>;
      if (!data.success || !data.data) return null;
      return {
        role: data.data.role as UserRole,
        name: data.data.name,
        username: data.data.username
      };
    }
    return null;
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.warn('[UserContext] 解析本地用户信息失败:', e);
    }
    return null;
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化时检查本地存储的会话
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('authToken');
      const savedRole = localStorage.getItem('userRole') as UserRole | null;
      const savedName = localStorage.getItem('itsName');
      const savedUsername = localStorage.getItem('itsUsername');

      if (savedToken && savedRole) {
        // 验证服务器端的会话是否仍然有效
        const serverData = await verifyTokenOnServer(savedToken);
        if (serverData) {
          setToken(savedToken);
          setUser(createUser(
            serverData.role as UserRole,
            savedToken,
            savedName || undefined,
            savedUsername || undefined
          ));
          setIsLoggedIn(true);
        } else {
          // 会话已过期，清除本地存储
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          localStorage.removeItem('itsName');
          localStorage.removeItem('itsUsername');
        }
      }
      setIsLoading(false);
    };

    initAuth();
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

      const data = await readApiResponse(response) as ApiResponse<AuthResponse>;

      if (!data.success || !data.data) {
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
