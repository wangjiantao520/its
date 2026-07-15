'use client';

import { useEffect, useState } from 'react';
import { BarChart3, FileText, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ReportStats {
  overview: {
    totalCount: number;
    totalAmount: number;
    avgAmount: number;
    engineeringCount: number;
    maintenanceCount: number;
  };
  topUsers: Array<{ userId: string; userName: string; totalAmount: number; totalCount: number }>;
  monthlyStats: Array<{ month: string; totalAmount: number; totalCount: number }>;
  byStatus: Array<{ status: string; count: number; amount: number }>;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

function currency(value: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value);
}

export default function ReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/dashboard/stats');
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || '加载报表失败');
        setStats(result.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '加载报表失败');
      }
    };
    void load();
  }, []);

  if (error) return <div className="py-16 text-center text-destructive">{error}</div>;
  if (!stats) return <div className="py-16 text-center text-muted-foreground">正在加载报表...</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">报表统计</h1><p className="mt-1 text-muted-foreground">工程与维保报价实时统计</p></div>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="累计报价额" value={currency(stats.overview.totalAmount)} hint="全部有效报价" icon={<TrendingUp className="h-4 w-4" />} />
        <Metric title="平均报价额" value={currency(stats.overview.avgAmount)} hint="每笔平均" icon={<BarChart3 className="h-4 w-4" />} />
        <Metric title="工程报价" value={String(stats.overview.engineeringCount)} hint="笔" icon={<FileText className="h-4 w-4" />} />
        <Metric title="维保及综合报价" value={String(stats.overview.maintenanceCount)} hint="笔" icon={<Users className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>近12个月报价金额</CardTitle><CardDescription>按创建月份汇总</CardDescription></CardHeader><CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={stats.monthlyStats}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="totalAmount" name="报价金额" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>报价状态分布</CardTitle><CardDescription>各状态报价数量</CardDescription></CardHeader><CardContent className="h-80">
          {stats.byStatus.length === 0 ? <div className="flex h-full items-center justify-center text-muted-foreground">暂无数据</div> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.byStatus} dataKey="count" nameKey="status" innerRadius={60} outerRadius={105} label>{stats.byStatus.map((entry, index) => <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>}
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>成员报价排名</CardTitle><CardDescription>按累计报价金额排序</CardDescription></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead className="w-16">排名</TableHead><TableHead>成员</TableHead><TableHead className="text-right">累计金额</TableHead><TableHead className="text-right">报价次数</TableHead></TableRow></TableHeader><TableBody>
          {stats.topUsers.length === 0 ? <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">暂无报价数据</TableCell></TableRow> : stats.topUsers.map((user, index) => <TableRow key={user.userId}><TableCell><Badge variant={index < 3 ? 'default' : 'secondary'}>{index + 1}</Badge></TableCell><TableCell>{user.userName}</TableCell><TableCell className="text-right font-semibold">{currency(user.totalAmount)}</TableCell><TableCell className="text-right">{user.totalCount}</TableCell></TableRow>)}
        </TableBody></Table>
      </CardContent></Card>
    </div>
  );
}

function Metric({ title, value, hint, icon }: { title: string; value: string; hint: string; icon: React.ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div><p className="mt-1 text-xs text-muted-foreground">{hint}</p></CardContent></Card>;
}
