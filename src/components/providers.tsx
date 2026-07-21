'use client';

import React from 'react';
import { UserProvider } from '@/contexts/user-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { Toaster } from 'sonner';
import { AuthProtected } from '@/components/auth-protected';
import { AppLayout } from '@/components/layout/app-layout';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <UserProvider>
        <AuthProtected>
          <AppLayout>{children}</AppLayout>
          <Toaster position="top-right" />
        </AuthProtected>
      </UserProvider>
    </ThemeProvider>
  );
}
