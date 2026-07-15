'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { UserRole, Role } from '@/lib/roles';
import { isAllowedPath, isPublicPath } from '@/lib/route-access';

interface AuthProtectedProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

// 角色权限映射
const ROLE_PATHS: Record<UserRole, string[]> = {
  'its_member': ['/', '/device-import', '/maintenance', '/engineering', '/survey-upload', '/quotes', '/history', '/clients', '/dashboard', '/reports', '/assistant'],
  'admin': ['/', '/dashboard', '/engineering', '/quotes', '/maintenance', '/survey-upload', '/data', '/history', '/database', '/clients', '/reports', '/admin', '/admin/users', '/admin/ai-config', '/admin/agents', '/admin/dashboard', '/admin/members', '/device-review', '/settings/ai-models']
};

export function AuthProtected({ children, allowedRoles }: AuthProtectedProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoggedIn, isLoading } = useUser();

  useEffect(() => {
    // 如果是公开路径，不需要登录
    if (isPublicPath(pathname)) {
      return;
    }

    // 关键：等 UserProvider 初始化完成（读取 localStorage 并调 verifyTokenOnServer）后，再判断登录状态
    // 否则初次渲染时 isLoggedIn 始终为 false，会错误地跳转到登录页
    if (isLoading) {
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
    if (!isAllowedPath(pathname, allowedPaths)) {
      // 如果是根路径，允许访问
      if (pathname === '/') {
        return;
      }
      // 跳转到对应角色的首页
      const homePath = allowedPaths[0] || '/';
      router.push(homePath);
    }
  }, [isLoggedIn, user, pathname, router, allowedRoles, isLoading]);

  // 如果是公开路径，直接渲染
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  // 加载中：显示加载占位符（避免闪烁和误判）
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  // 如果未登录，不渲染内容（useEffect 会处理跳转）
  if (!isLoggedIn || !user) {
    return null;
  }

  // 渲染内容
  return <>{children}</>;
}
