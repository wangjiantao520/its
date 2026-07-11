'use client';

import { ReactNode } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/user-context';

interface AppLayoutProps {
  children: ReactNode;
}

const pathNameMap: Record<string, string> = {
  '/': '首页',
  '/engineering': '工程报价',
  '/maintenance': '维保报价',
  '/data': '数据管理',
  '/history': '历史记录',
};

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { isLoggedIn } = useUser();
  const currentPage = pathNameMap[pathname] || '页面';

  // 如果是登录页面，只显示内容，不显示侧边栏
  if (pathname === '/login' || !isLoggedIn) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">首页</BreadcrumbLink>
              </BreadcrumbItem>
              {pathname !== '/' && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{currentPage}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 overflow-auto w-full">
          <div className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6 md:py-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
