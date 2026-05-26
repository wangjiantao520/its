'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, Role } from '@/lib/roles';

interface UserContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  setUserRole: (role: UserRole) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// 创建用户对象
function createUser(role: UserRole): User {
  return {
    id: role === 'admin' ? 'admin-1' : 'its-1',
    name: role === 'admin' ? '系统管理员' : 'ITS成员',
    role: role
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 初始化时检查localStorage是否有登录状态
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    if (savedRole) {
      const role = savedRole as UserRole;
      setUser(createUser(role));
      setIsLoggedIn(true);
    }
  }, []);

  const login = (role: UserRole) => {
    const newUser = createUser(role);
    setUser(newUser);
    setIsLoggedIn(true);
    localStorage.setItem('userRole', role);
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('userRole');
  };

  const setUserRole = (role: UserRole) => {
    if (user) {
      const newUser = { ...user, role };
      setUser(newUser);
      localStorage.setItem('userRole', role);
    }
  };

  return (
    <UserContext.Provider value={{ user, isLoggedIn, login, logout, setUserRole }}>
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
