'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FileText,
  Clock,
  AlertTriangle,
  TrendingUp,
  Plus,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';

// Mock data for statistics
const stats = {
  totalQuotes: 156,
  thisMonth: 23,
  pendingReview: 8,
  expiringSoon: 5,
};

// Mock data for monthly trends (last 6 months)
const monthlyTrends = [
  { month: '1月', quotes: 18 },
  { month: '2月', quotes: 24 },
  { month: '3月', quotes: 21 },
  { month: '4月', quotes: 32 },
  { month: '5月', quotes: 28 },
  { month: '6月', quotes: 23 },
];

// Mock data for recent activity
const recentActivity = [
  {
    id: 1,
    action: '报价已通过',
    quote: 'Q-2024-0156',
    client: '科技有限公司',
    time: '2小时前',
    type: 'approved',
  },
  {
    id: 2,
    action: '新建报价',
    quote: 'Q-2024-0155',
    client: '全球解决方案',
    time: '4小时前',
    type: 'created',
  },
  {
    id: 3,
    action: '报价已驳回',
    quote: 'Q-2024-0154',
    client: '星辰科技',
    time: '6小时前',
    type: 'rejected',
  },
  {
    id: 4,
    action: '待审核',
    quote: 'Q-2024-0153',
    client: '阿尔法工业',
    time: '8小时前',
    type: 'pending',
  },
  {
    id: 5,
    action: '已发送客户',
    quote: 'Q-2024-0152',
    client: '贝塔集团',
    time: '1天前',
    type: 'sent',
  },
];

// Mock data for expiring items
const expiringItems = [
  {
    id: 1,
    type: 'contract',
    name: '办公室网络升级',
    client: '科技有限公司',
    expiryDate: '2024-07-15',
    daysLeft: 12,
  },
  {
    id: 2,
    type: 'device',
    name: '服务器维保合同',
    client: '数据系统公司',
    expiryDate: '2024-07-20',
    daysLeft: 17,
  },
  {
    id: 3,
    type: 'contract',
    name: '安防系统安装',
    client: '安联网',
    expiryDate: '2024-07-25',
    daysLeft: 22,
  },
];

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'approved':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'created':
    case 'sent':
      return <FileText className="h-4 w-4 text-blue-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

const getActivityBadge = (type: string) => {
  switch (type) {
    case 'approved':
      return <Badge variant="default" className="bg-green-500">已通过</Badge>;
    case 'rejected':
      return <Badge variant="destructive">已驳回</Badge>;
    case 'created':
      return <Badge variant="secondary">新建</Badge>;
    case 'sent':
      return <Badge variant="outline">已发送</Badge>;
    case 'pending':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">待审核</Badge>;
    default:
      return <Badge variant="outline">未知</Badge>;
  }
};

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">数据看板</h1>
          <p className="text-muted-foreground">
            维保报价系统概览
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            新建报价
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              报价总数
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuotes}</div>
            <p className="text-xs text-muted-foreground">
              较上月增长 12%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              本月新增
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">
              较上月增加 5 个
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              待审核
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingReview}</div>
            <p className="text-xs text-muted-foreground">
              其中 3 个待批准
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              即将到期
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">
              未来 30 天内
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Monthly Trends Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>月度报价趋势</CardTitle>
            <CardDescription>
              近6个月报价数量统计
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar
                    dataKey="quotes"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="报价数"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expiring Items */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" />
              即将到期
            </CardTitle>
            <CardDescription>
              未来30天内到期的合同和设备
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expiringItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.client}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge
                        variant="outline"
                        className={
                          item.daysLeft <= 14
                            ? 'border-orange-500 text-orange-600'
                            : 'border-yellow-500 text-yellow-600'
                        }
                      >
                        剩余 {item.daysLeft} 天
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    查看
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>最近操作</CardTitle>
            <CardDescription>
              报价最新动态
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {activity.action}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {activity.quote}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {activity.client}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getActivityBadge(activity.type)}
                    <span className="text-xs text-muted-foreground">
                      {activity.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
            <CardDescription>
              常用功能入口
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="default" className="w-full justify-start">
              <Plus className="mr-2 h-4 w-4" />
              新建报价
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Eye className="mr-2 h-4 w-4" />
              待审核报价
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Download className="mr-2 h-4 w-4" />
              导出报表
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <FileText className="mr-2 h-4 w-4" />
              报价管理
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
