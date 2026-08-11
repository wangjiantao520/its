'use client';

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
  LayoutDashboard, Calculator, Wrench, ListFilter, Library, BarChart3,
  UserCheck, Bot, Sparkles, Database, Upload, History,
} from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { AiChat } from '@/components/ai-chat';

interface ModuleCard {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string;
}

const ADMIN_MODULES: ModuleCard[] = [
  { title: '数据看板', description: '报价统计与分析', icon: LayoutDashboard, href: '/admin/dashboard', color: 'text-blue-600' },
  { title: '工程报价', description: '创建和管理工程报价', icon: Calculator, href: '/engineering', color: 'text-blue-600' },
  { title: '维保报价', description: '创建和管理维保报价', icon: Wrench, href: '/maintenance', color: 'text-cyan-600' },
  { title: '报价管理', description: '统一审批和管理报价', icon: ListFilter, href: '/quotes', color: 'text-indigo-600' },
  { title: '报价资料库', description: '管理历史报价资料', icon: Library, href: '/admin/quote-library', color: 'text-purple-600' },
  { title: '报表统计', description: '全局统计报表', icon: BarChart3, href: '/reports', color: 'text-emerald-600' },
  { title: '账号管理', description: '管理管理员和成员账号', icon: UserCheck, href: '/admin/members', color: 'text-rose-600' },
  { title: 'AI配置中心', description: '智能体和AI模型配置', icon: Bot, href: '/admin/ai-config', color: 'text-violet-600' },
  { title: '智能体管理', description: '智能体与技能管理', icon: Sparkles, href: '/admin/agents', color: 'text-amber-600' },
  { title: '基础数据管理', description: '维护定额与系统参数', icon: Database, href: '/database', color: 'text-slate-600' },
  { title: '设备清单导入', description: '提交设备清单审核', icon: Upload, href: '/device-import', color: 'text-teal-600' },
  { title: '历史记录', description: '查看历史报价', icon: History, href: '/history', color: 'text-gray-600' },
];

const MEMBER_MODULES: ModuleCard[] = [
  { title: '工程报价', description: '创建和管理工程报价', icon: Calculator, href: '/engineering', color: 'text-blue-600' },
  { title: '维保报价', description: '创建和管理维保报价', icon: Wrench, href: '/maintenance', color: 'text-cyan-600' },
  { title: '设备清单导入', description: '提交设备清单审核', icon: Upload, href: '/device-import', color: 'text-teal-600' },
  { title: '智能助手', description: '和 AI 对话', icon: Bot, href: '/assistant', color: 'text-violet-600' },
  { title: '报价资料库', description: '浏览历史报价资料', icon: Library, href: '/quote-library', color: 'text-purple-600' },
  { title: '历史记录', description: '查看历史报价', icon: History, href: '/history', color: 'text-gray-600' },
];

export default function Home() {
  const { user, isLoggedIn } = useUser();
  const modules = user?.role === 'admin' ? ADMIN_MODULES : MEMBER_MODULES;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">欢迎使用ITS报价系统</h1>
        <p className="text-muted-foreground mt-1">
          快速访问系统各个功能模块
        </p>
      </div>

      {/* 功能模块卡片 */}
      {isLoggedIn && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {modules.map((module, index) => (
            <Link href={module.href} key={index}>
              <Card className="h-full cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <module.icon className={`h-6 w-6 ${module.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{module.title}</CardTitle>
                      <CardDescription className="text-xs">{module.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary">进入模块 →</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!isLoggedIn && (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>请登录后访问系统功能</p>
        </div>
      )}

      {/* AI 智能助手 */}
      {isLoggedIn && <AiChat />}
    </div>
  );
}
