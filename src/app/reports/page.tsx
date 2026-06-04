'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, Users, FileText } from 'lucide-react';

const MOCK_MONTHLY_DATA = [
  { month: '1月', amount: 125000 }, { month: '2月', amount: 89000 }, { month: '3月', amount: 156000 },
  { month: '4月', amount: 203000 }, { month: '5月', amount: 178000 }, { month: '6月', amount: 245000 },
  { month: '7月', amount: 198000 }, { month: '8月', amount: 312000 }, { month: '9月', amount: 276000 },
  { month: '10月', amount: 389000 }, { month: '11月', amount: 425000 }, { month: '12月', amount: 356000 },
];
const MOCK_STATUS_DATA = [
  { name: '已报价', value: 45, color: '#3b82f6' }, { name: '已确认', value: 28, color: '#22c55e' },
  { name: '已签约', value: 15, color: '#8b5cf6' }, { name: '已取消', value: 8, color: '#ef4444' },
  { name: '进行中', value: 12, color: '#f59e0b' },
];

const MOCK_REGION_DATA = [
  { region: '蕉城', count: 42 }, { region: '福安', count: 28 }, { region: '福鼎', count: 25 },
  { region: '霞浦', count: 18 }, { region: '周宁', count: 12 }, { region: '寿宁', count: 8 },
  { region: '屏南', count: 7 }, { region: '古田', count: 15 }, { region: '柘荣', count: 5 },
];

const MOCK_TOP_CLIENTS = [
  { rank: 1, name: '宁德市政府办公室', totalAmount: 895000, quoteCount: 12, status: '已签约' },
  { rank: 2, name: '福安市人民医院', totalAmount: 756000, quoteCount: 8, status: '已确认' },
  { rank: 3, name: '蕉城区教育局', totalAmount: 623000, quoteCount: 15, status: '已报价' },
  { rank: 4, name: '福鼎市人民法院', totalAmount: 489000, quoteCount: 6, status: '已签约' },
  { rank: 5, name: '霞浦县公安局', totalAmount: 412000, quoteCount: 9, status: '已确认' },
  { rank: 6, name: '周宁县第一中学', totalAmount: 358000, quoteCount: 5, status: '已报价' },
  { rank: 7, name: '寿宁县自来水公司', totalAmount: 295000, quoteCount: 7, status: '进行中' },
  { rank: 8, name: '屏南县文化馆', totalAmount: 267000, quoteCount: 4, status: '已报价' },
  { rank: 9, name: '古田县供电公司', totalAmount: 234000, quoteCount: 6, status: '已确认' },
  { rank: 10, name: '柘荣县妇幼保健院', totalAmount: 198000, quoteCount: 3, status: '已签约' },
];

const STATUS_COLORS: Record<string, string> = {
  '已签约': 'bg-green-100 text-green-700',
  '已确认': 'bg-blue-100 text-blue-700',
  '已报价': 'bg-slate-100 text-slate-700',
  '进行中': 'bg-amber-100 text-amber-700',
  '已取消': 'bg-red-100 text-red-700',
};

const formatCurrency = (amount: number) => {
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万`;
  return `¥${amount.toLocaleString('zh-CN')}`;
};

export default function ReportsPage() {
  const totalQuotes = MOCK_MONTHLY_DATA.reduce((sum, m) => sum + m.amount, 0);
  const avgMonthly = totalQuotes / 12;
  const confirmedCount = MOCK_STATUS_DATA.find(s => s.name === '已确认')?.value ?? 0;
  const signedCount = MOCK_STATUS_DATA.find(s => s.name === '已签约')?.value ?? 0;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">报表统计</h1><p className="text-muted-foreground mt-1">维保报价数据统计与分析</p></div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">年度总报价额</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(totalQuotes)}</div><p className="text-xs text-muted-foreground mt-1">全年累计</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">月均报价额</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(avgMonthly)}</div><p className="text-xs text-muted-foreground mt-1">月平均</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">已确认报价</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{confirmedCount}</div><p className="text-xs text-muted-foreground mt-1">笔</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">已签约项目</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{signedCount}</div><p className="text-xs text-muted-foreground mt-1">个</p></CardContent></Card>
      </div>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" />月度报价金额</CardTitle><CardDescription>各月报价金额统计（单位：元）</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={MOCK_MONTHLY_DATA}><CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" /><XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} /><Tooltip formatter={(value: number) => [`¥${value.toLocaleString('zh-CN')}`, '报价金额']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} /><Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="报价金额" /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-600" />报价状态分布</CardTitle><CardDescription>各状态报价数量占比</CardDescription></CardHeader><CardContent><div className="flex items-center"><ResponsiveContainer width="60%" height={300}><PieChart><Pie data={MOCK_STATUS_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="value">{MOCK_STATUS_DATA.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(value: number) => [value, '数量']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} /></PieChart></ResponsiveContainer><div className="flex-1 space-y-3">{MOCK_STATUS_DATA.map((item) => (<div key={item.name} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-sm">{item.name}</span></div><span className="text-sm font-semibold">{item.value}</span></div>))}</div></div></CardContent></Card>
      </div>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-1"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-purple-600" />客户地区分布</CardTitle><CardDescription>各区县客户数量统计</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={MOCK_REGION_DATA} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" /><XAxis type="number" tick={{ fontSize: 12 }} /><YAxis dataKey="region" type="category" tick={{ fontSize: 12 }} width={50} /><Tooltip formatter={(value: number) => [value, '客户数量']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} /><Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="客户数量" /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-orange-600" />Top 10 客户排名</CardTitle><CardDescription>按累计报价金额排名</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead className="w-12 text-center">排名</TableHead><TableHead>客户名称</TableHead><TableHead className="text-right">累计金额</TableHead><TableHead className="text-center">报价次数</TableHead><TableHead className="text-center">最新状态</TableHead></TableRow></TableHeader><TableBody>{MOCK_TOP_CLIENTS.map((client) => (<TableRow key={client.rank}><TableCell className="text-center">{client.rank <= 3 ? <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${client.rank === 1 ? 'bg-yellow-100 text-yellow-700' : client.rank === 2 ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700'}`}>{client.rank}</span> : <span className="text-muted-foreground">{client.rank}</span>}</TableCell><TableCell className="font-medium">{client.name}</TableCell><TableCell className="text-right font-semibold text-blue-700">{formatCurrency(client.totalAmount)}</TableCell><TableCell className="text-center text-muted-foreground">{client.quoteCount}次</TableCell><TableCell className="text-center"><Badge className={STATUS_COLORS[client.status] ?? 'bg-slate-100 text-slate-700'}>{client.status}</Badge></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
      </div>
    </div>
  );
}
