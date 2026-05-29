import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, Wrench, Plus, History } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const quickActions = [
    {
      title: '新建工程报价',
      description: '创建新的工程报价单',
      icon: Calculator,
      href: '/engineering',
      color: 'text-blue-600',
    },
    {
      title: '新建维保报价',
      description: '创建新的维保报价单',
      icon: Wrench,
      href: '/maintenance',
      color: 'text-cyan-600',
    },
    {
      title: '查看历史记录',
      description: '查看历史报价单',
      icon: History,
      href: '/history',
      color: 'text-gray-600',
    },
  ];



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">欢迎使用工程报价系统</h1>
        <p className="text-muted-foreground mt-1">
          快速创建和管理工程报价及维保报价
        </p>
      </div>

      {/* 快速操作 */}
      <div className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action, index) => (
          <Link href={action.href} key={index}>
            <Card className="h-full cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <action.icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  立即开始
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
