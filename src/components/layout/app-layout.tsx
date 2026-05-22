'use client';

import { ReactNode } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { usePathname } from 'next/navigation';

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
  const currentPage = pathNameMap[pathname] || '页面';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card px-6">
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
        <main className="flex-1 overflow-auto bg-muted/30 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
