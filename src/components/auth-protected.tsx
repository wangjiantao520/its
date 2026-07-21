'use client';

import { useEffect, useState } from 'react';
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
  // 本地快速判断：从 localStorage 读取，避免等待 context 初始化导致的加载中闪烁
  const [localHasToken, setLocalHasToken] = useState(false);

  // 同步检查 localStorage，快速判断是否有登录态
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    setLocalHasToken(!!token && !!role);
  }, []);

  // 如果 isLoading 为 true 但本地有 token，认为是已登录状态（乐观渲染）
  // 这样用户不会看到"加载中"闪烁
  const showLoading = isLoading && !localHasToken;

  useEffect(() => {
    // 如果是公开路径，不需要登录，直接返回
    if (isPublicPath(pathname)) {
      return;
    }

    // 还在加载中，但本地有 token → 乐观显示内容，等验证完成后再调整
    // 还在加载中，且本地没有 token → 显示加载中（很快就会结束）
    if (isLoading && localHasToken) {
      return;
    }

    // 如果未登录，跳转到登录页
    if (!isLoggedIn || !user) {
      // 还在加载中就不跳（避免误判）
      if (isLoading) return;
      
      // 使用 window.location.href 而不是 router.push，避免中断正在进行的 RSC 请求
      if (pathname !== '/login') {
        window.location.href = '/login';
      }
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
        window.location.href = homePath;
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
      window.location.href = homePath;
    }
  }, [isLoggedIn, user, pathname, router, allowedRoles, isLoading, localHasToken]);

  // 如果是公开路径，直接渲染
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  // 加载中且本地没有 token：显示加载占位符
  if (showLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  // 本地有 token 但还在加载中：乐观显示内容
  if (isLoading && localHasToken) {
    return <>{children}</>;
  }

  // 如果未登录，不渲染内容（useEffect 会处理跳转）
  if (!isLoggedIn || !user) {
    return null;
  }

  // 渲染内容
  return <>{children}</>;
}
