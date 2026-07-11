'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, Users, FileText, DollarSign, TrendingUp, Building2, Wrench, Clock, Eye } from 'lucide-react';

interface DashboardStats {
  overview: {
    totalCount: number;
    totalAmount: number;
    avgAmount: number;
    engineeringCount: number;
    engineeringAmount: number;
    maintenanceCount: number;
    maintenanceAmount: number;
  };
  topUsers: Array<{
    userId: string;
    userName: string;
    engineeringCount: number;
    engineeringAmount: number;
    maintenanceCount: number;
    maintenanceAmount: number;
    totalCount: number;
    totalAmount: number;
  }>;
  monthlyStats: Array<{
    month: string;
    engineeringCount: number;
    engineeringAmount: number;
    maintenanceCount: number;
    maintenanceAmount: number;
    totalCount: number;
    totalAmount: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  recentQuotes: Array<{
    id: number;
    quote_number: string;
    project_name: string;
    client_name: string;
    total: number;
    status: string;
    type: string;
    created_by: string;
    created_by_name: string;
    created_at: string;
  }>;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(amount);
};

const formatNumber = (num: number): string => {
  if (num >= 100000000) {
    return (num / 100000000).toFixed(2) + '亿';
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(2) + '万';
  }
  return num.toFixed(2);
};

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; className: string }> = {
    draft: { label: '草稿', className: 'bg-gray-100 text-gray-800' },
    submitted: { label: '已提交', className: 'bg-blue-100 text-blue-800' },
    approved: { label: '已审核', className: 'bg-green-100 text-green-800' },
    rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800' },
    completed: { label: '已完成', className: 'bg-emerald-100 text-emerald-800' },
  };
  const s = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return <Badge className={s.className}>{s.label}</Badge>;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('all');

  useEffect(() => {
    fetchStats();
  }, [selectedUserId, timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUserId !== 'all') {
        params.set('user_id', selectedUserId);
      }
      if (timeRange !== 'all') {
        params.set('time_range', timeRange);
      }
      
      const response = await fetch(`/api/dashboard/stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.data);
        }
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (type: string, id: number) => {
    if (type === 'engineering') {
      window.open(`/engineering?id=${id}`, '_blank');
    } else {
      window.open(`/maintenance?id=${id}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">暂无数据</div>
      </div>
    );
  }

  // 计算柱状图最大值（简易实现）
  const maxMonthlyAmount = Math.max(...stats.monthlyStats.map(m => m.totalAmount), 1);

  return (
    <div className="space-y-6">
      {/* 页面标题和筛选器 */}
      <div className="fabric-card p-6 bg-linen-texture">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold stamp-text">数据看板</h1>
            <p className="text-muted-foreground text-sm mt-1">ITS成员报价数据统计与分析</p>
          </div>
          <div className="flex gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] input-fabric h-10">
                <SelectValue placeholder="时间范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部时间</SelectItem>
                <SelectItem value="today">今日</SelectItem>
                <SelectItem value="week">近7天</SelectItem>
                <SelectItem value="month">本月</SelectItem>
                <SelectItem value="year">本年</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[140px] input-fabric h-10">
                <SelectValue placeholder="选择成员" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部成员</SelectItem>
                {stats.topUsers.map((user) => (
                  <SelectItem key={user.userId} value={user.userId}>
                    {user.userName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 总览统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="fabric-card p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -mr-8 -mt-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">报价总数</span>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground font-serif">{stats.overview.totalCount}</div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                工程 {stats.overview.engineeringCount}
              </span>
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                维保 {stats.overview.maintenanceCount}
              </span>
            </div>
          </div>
        </div>

        <div className="fabric-card p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-moss/10 rounded-full -mr-8 -mt-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">报价总额</span>
              <div className="w-10 h-10 rounded-lg bg-moss/15 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-moss" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground font-serif">
              {formatCurrency(stats.overview.totalAmount)}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>工程 {formatNumber(stats.overview.engineeringAmount)}</span>
              <span>维保 {formatNumber(stats.overview.maintenanceAmount)}</span>
            </div>
          </div>
        </div>

        <div className="fabric-card p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-terracotta/10 rounded-full -mr-8 -mt-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">平均报价</span>
              <div className="w-10 h-10 rounded-lg bg-terracotta/15 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-terracotta" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground font-serif">
              {formatCurrency(stats.overview.avgAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              单次报价平均金额
            </p>
          </div>
        </div>

        <div className="fabric-card p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-clay/10 rounded-full -mr-8 -mt-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">活跃成员</span>
              <div className="w-10 h-10 rounded-lg bg-clay/15 flex items-center justify-center">
                <Users className="h-5 w-5 text-clay" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground font-serif">{stats.topUsers.length}</div>
            <p className="text-xs text-muted-foreground mt-3">
              有报价记录的成员数
            </p>
          </div>
        </div>
      </div>

      {/* 月度趋势和成员统计 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 月度趋势 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              月度报价趋势
            </CardTitle>
            <CardDescription>近12个月报价数量和金额趋势</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-end justify-between gap-2 pt-4">
              {stats.monthlyStats.map((month) => (
                <div key={month.month} className="flex flex-col items-center flex-1 gap-2">
                  <div className="flex items-end gap-1 h-[220px] w-full justify-center">
                    {/* 工程报价柱 */}
                    <div
                      className="bg-primary/80 w-3 rounded-t-sm transition-all hover:bg-primary"
                      style={{
                        height: `${(month.engineeringAmount / maxMonthlyAmount) * 100}%`,
                        minHeight: month.engineeringAmount > 0 ? '4px' : '0'
                      }}
                      title={`工程: ${formatCurrency(month.engineeringAmount)}`}
                    />
                    {/* 维保报价柱 */}
                    <div
                      className="bg-emerald-500/80 w-3 rounded-t-sm transition-all hover:bg-emerald-500"
                      style={{
                        height: `${(month.maintenanceAmount / maxMonthlyAmount) * 100}%`,
                        minHeight: month.maintenanceAmount > 0 ? '4px' : '0'
                      }}
                      title={`维保: ${formatCurrency(month.maintenanceAmount)}`}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {month.month.slice(5)}月
                  </div>
                  <div className="text-xs font-medium">
                    {month.totalCount}单
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-sm" />
                <span className="text-sm text-muted-foreground">工程报价</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                <span className="text-sm text-muted-foreground">维保报价</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 成员报价排行 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              成员报价排行
            </CardTitle>
            <CardDescription>按报价总额排名</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topUsers.slice(0, 10).map((user, index) => (
                <div key={user.userId} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-amber-100 text-amber-700' :
                    index === 1 ? 'bg-gray-100 text-gray-600' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{user.userName}</span>
                      <span className="text-sm font-semibold">{formatNumber(user.totalAmount)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {user.engineeringCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        {user.maintenanceCount}
                      </span>
                      <span>{user.totalCount}单</span>
                    </div>
                    {/* 进度条 */}
                    <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full"
                        style={{
                          width: `${(user.totalAmount / (stats.topUsers[0]?.totalAmount || 1)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {stats.topUsers.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  暂无成员数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 状态分布和最近报价 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 按状态分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              状态分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                    <span className="text-sm text-muted-foreground">{item.count} 单</span>
                  </div>
                  <span className="font-semibold">{formatNumber(item.amount)}</span>
                </div>
              ))}
              {stats.byStatus.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-4">
                  暂无数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 最近报价记录 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              最近报价
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>报价编号</TableHead>
                  <TableHead>项目名称</TableHead>
                  <TableHead>创建人</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentQuotes.slice(0, 10).map((quote) => (
                  <TableRow key={`${quote.type}-${quote.id}`}>
                    <TableCell className="font-medium font-mono text-sm">
                      {quote.quote_number}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={quote.project_name}>
                      {quote.project_name}
                    </TableCell>
                    <TableCell>{quote.created_by_name || '-'} </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        quote.type === 'engineering' 
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      }>
                        {quote.type === 'engineering' ? '工程' : '维保'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(quote.total)}</TableCell>
                    <TableCell>{getStatusBadge(quote.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleViewDetail(quote.type, quote.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {stats.recentQuotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      暂无报价记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 成员详细统计表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            成员报价详情
          </CardTitle>
          <CardDescription>各成员报价数据明细</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>排名</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead className="text-right">工程报价数</TableHead>
                <TableHead className="text-right">工程报价额</TableHead>
                <TableHead className="text-right">维保报价数</TableHead>
                <TableHead className="text-right">维保报价额</TableHead>
                <TableHead className="text-right">总报价数</TableHead>
                <TableHead className="text-right">总报价额</TableHead>
                <TableHead className="text-right">平均报价</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.topUsers.map((user, index) => (
                <TableRow key={user.userId}>
                  <TableCell>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-gray-100 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{user.userName}</TableCell>
                  <TableCell className="text-right">{user.engineeringCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(user.engineeringAmount)}</TableCell>
                  <TableCell className="text-right">{user.maintenanceCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(user.maintenanceAmount)}</TableCell>
                  <TableCell className="text-right font-semibold">{user.totalCount}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {formatCurrency(user.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(user.totalCount > 0 ? user.totalAmount / user.totalCount : 0)}
                  </TableCell>
                </TableRow>
              ))}
              {stats.topUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    暂无成员数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
