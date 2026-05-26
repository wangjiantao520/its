'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole, getCurrentUser, switchUserRole } from '@/lib/roles';

interface UserContextType {
  user: User;
  setUserRole: (role: UserRole) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(getCurrentUser());

  const setUserRole = (role: UserRole) => {
    setUser(switchUserRole(role));
  };

  return (
    <UserContext.Provider value={{ user, setUserRole }}>
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
