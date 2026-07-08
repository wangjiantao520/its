'use client';

import {
  Calculator,
  Database,
  FileText,
  Home,
  Settings,
  Wrench,
  History,
  Upload,
  CheckSquare,
  User,
  LogOut,
  Sun,
  Moon,
  ListFilter,
  Users,
  LayoutDashboard,
  BarChart3,
  FileSpreadsheet,
  Copy,
  UserCheck,
  Bot,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
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
import { useUser } from '@/contexts/user-context';
import { useTheme } from '@/contexts/theme-context';
import { UserRole, Role } from '@/lib/roles';
import { Button } from '@/components/ui/button';

// ITS成员的导航项
const itsMemberNavItems = [
  {
    title: '首页',
    url: '/',
    icon: Home,
  },
  {
    title: '维保报价',
    url: '/maintenance',
    icon: Wrench,
  },
  {
    title: '设备清单导入',
    url: '/device-import',
    icon: Upload,
  },
];

// 管理员的导航项
const adminNavItems = [
  {
    title: '首页',
    url: '/',
    icon: Home,
  },
  {
    title: '数据看板',
    url: '/dashboard',
    icon: LayoutDashboard,
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
    title: '报价管理',
    url: '/quotes',
    icon: ListFilter,
  },
  {
    title: '客户管理',
    url: '/clients',
    icon: Users,
  },
  {
    title: '报表统计',
    url: '/reports',
    icon: BarChart3,
  },
  {
    title: 'ITS成员管理',
    url: '/admin/users',
    icon: UserCheck,
  },
  {
    title: '设备清单审核',
    url: '/device-review',
    icon: CheckSquare,
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
  {
    title: 'AI模型配置',
    url: '/settings/ai-models',
    icon: Bot,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoggedIn } = useUser();
  const { theme, toggleTheme } = useTheme();

  // 如果未登录，不显示侧边栏
  if (!isLoggedIn || !user) {
    return null;
  }

  const navItems = user.role === 'admin' ? adminNavItems : itsMemberNavItems;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <Sidebar variant="inset" className="border-r">
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">ITS报价系统</h1>
            <p className="text-xs text-muted-foreground">宁德移动ICT项目</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
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
      <SidebarFooter className="border-t p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              user.role === 'admin' 
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' 
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            }`}>
              {user.role === 'admin' ? '管理员' : 'ITS成员'}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          <p>版本 1.0.0</p>
          <p className="mt-1">© 2026 ITS</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
