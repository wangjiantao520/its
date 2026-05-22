import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, FileText, TrendingUp, Wrench, Plus, History } from 'lucide-react';
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

  const stats = [
    {
      title: '今日报价',
      value: '12',
      description: '较昨日 +3',
      icon: FileText,
    },
    {
      title: '总报价金额',
      value: '¥286,500',
      description: '本月累计',
      icon: TrendingUp,
    },
    {
      title: '工程报价',
      value: '8',
      description: '待处理',
      icon: Calculator,
    },
    {
      title: '维保报价',
      value: '4',
      description: '待处理',
      icon: Wrench,
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

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
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

      {/* 最近记录 */}
      <Card>
        <CardHeader>
          <CardTitle>最近报价记录</CardTitle>
          <CardDescription>您最近创建的报价单</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">报价单 #{2024000 + i}</p>
                    <p className="text-sm text-muted-foreground">
                      {i % 2 === 0 ? '工程报价' : '维保报价'} · 2024-05-2{i}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">¥{(i * 15000 + 2000).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">已保存</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
