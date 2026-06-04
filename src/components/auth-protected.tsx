'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { UserRole, Role } from '@/lib/roles';

interface AuthProtectedProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

// 不需要登录的路径
const PUBLIC_PATHS = ['/login'];

// 角色权限映射
const ROLE_PATHS: Record<UserRole, string[]> = {
  'its_member': ['/device-import', '/maintenance', '/survey-upload', '/'],
  'admin': ['/device-review', '/engineering', '/quotes', '/maintenance', '/survey-upload', '/data', '/history', '/database', '/']
};

export function AuthProtected({ children, allowedRoles }: AuthProtectedProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoggedIn } = useUser();

  useEffect(() => {
    // 如果是公开路径，不需要登录
    if (PUBLIC_PATHS.includes(pathname)) {
      return;
    }

    // 如果未登录，跳转到登录页
    if (!isLoggedIn || !user) {
      router.push('/login');
      return;
    }

    // 检查角色权限
    const userRole = user.role as Role;
    const allowedPaths = ROLE_PATHS[userRole] || [];
    
    // 如果指定了允许的角色，检查当前用户角色是否在允许列表中
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(userRole)) {
        // 没有权限，跳转到对应角色的首页
        const homePath = allowedPaths[0] || '/';
        router.push(homePath);
        return;
      }
    }

    // 检查当前路径是否允许访问
    if (!allowedPaths.includes(pathname) && pathname !== '/login') {
      // 如果是根路径，允许访问
      if (pathname === '/') {
        return;
      }
      // 跳转到对应角色的首页
      const homePath = allowedPaths[0] || '/';
      router.push(homePath);
    }
  }, [isLoggedIn, user, pathname, router, allowedRoles]);

  // 如果是公开路径，直接渲染
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // 如果未登录，不渲染内容
  if (!isLoggedIn || !user) {
    return null;
  }

  // 渲染内容
  return <>{children}</>;
}
