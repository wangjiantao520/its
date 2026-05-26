'use client';

import {
  Calculator,
  Database,
  FileText,
  Home,
  Settings,
  Wrench,
  History,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import Link from 'next/link';

const navItems = [
  {
    title: '首页',
    url: '/',
    icon: Home,
  },
  {
    title: '工程报价',
    url: '/engineering',
    icon: Calculator,
  },
  {
    title: '维保报价',
    url: '/maintenance',
    icon: Wrench,
  },
  {
    title: '数据管理',
    url: '/data',
    icon: Settings,
  },
  {
    title: '历史记录',
    url: '/history',
    icon: History,
  },
  {
    title: '数据库管理',
    url: '/database',
    icon: Database,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" className="border-r">
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">工程报价系统</h1>
            <p className="text-xs text-muted-foreground">宁德移动ICT项目</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>功能模块</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          <p>版本 1.0.0</p>
          <p className="mt-1">© 2026 ITS</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
