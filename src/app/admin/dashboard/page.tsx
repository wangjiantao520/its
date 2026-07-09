'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { BarChart3, Users, FileText, DollarSign, TrendingUp, Eye, Trash2 } from 'lucide-react';

interface QuotationRecord {
  id: number;
  user_id: number;
  client_name: string;
  client_region?: string;
  project_name?: string;
  quote_type: string;
  total_amount: number;
  device_count: number;
  status: string;
  created_at: string;
  real_name?: string;
  username?: string;
}

interface UserStats {
  user_id: number;
  real_name: string;
  username: string;
  total_quotes: number;
  total_amount: number;
  avg_amount: number;
}

interface User {
  id: number;
  username: string;
  real_name: string;
}

export default function DashboardPage() {
  const [records, setRecords] = useState<QuotationRecord[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQuotes: 0,
    totalAmount: 0,
    avgAmount: 0,
    activeUsers: 0
  });

  useEffect(() => {
    fetchUsers();
    fetchRecords();
  }, [selectedUserId]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const url = selectedUserId === 'all' 
        ? '/api/quotations?page_size=100'
        : `/api/quotations?user_id=${selectedUserId}&page_size=100`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRecords(data.records || []);
        
        // 计算统计数据
        const records = data.records || [];
        const totalQuotes = records.length;
        const totalAmount = records.reduce((sum: number, r: QuotationRecord) => sum + r.total_amount, 0);
        const avgAmount = totalQuotes > 0 ? totalAmount / totalQuotes : 0;
        
        setStats({
          totalQuotes,
          totalAmount,
          avgAmount,
          activeUsers: new Set(records.map((r: QuotationRecord) => r.user_id)).size
        });

        // 计算每个用户的统计
        const userStatsMap = new Map<number, UserStats>();
        records.forEach((r: QuotationRecord) => {
          if (!userStatsMap.has(r.user_id)) {
            userStatsMap.set(r.user_id, {
              user_id: r.user_id,
              real_name: r.real_name || '',
              username: r.username || '',
              total_quotes: 0,
              total_amount: 0,
              avg_amount: 0
            });
          }
          const stat = userStatsMap.get(r.user_id)!;
          stat.total_quotes++;
          stat.total_amount += r.total_amount;
        });
        
        const userStatsArray = Array.from(userStatsMap.values()).map(s => ({
          ...s,
          avg_amount: s.total_quotes > 0 ? s.total_amount / s.total_quotes : 0
        }));
        setUserStats(userStatsArray);
      }
    } catch (error) {
      console.error('获取报价记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const response = await fetch(`/api/quotations/${id}`);
      if (response.ok) {
        const data = await response.json();
        alert(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('获取详情失败:', error);
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!confirm('确定要删除这条报价记录吗？')) return;
    
    try {
      const response = await fetch(`/api/quotations/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchRecords();
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">数据看板</h1>
        <p className="text-muted-foreground">查看ITS成员的报价数据和统计</p>
      </div>

      {/* 筛选器 */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择成员" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部成员</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id.toString()}>
                {user.real_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">报价总数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuotes}</div>
            <p className="text-xs text-muted-foreground">累计报价次数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">报价总额</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">累计报价金额</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均报价</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgAmount)}</div>
            <p className="text-xs text-muted-foreground">单次报价平均金额</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">有报价记录的用户数</p>
          </CardContent>
        </Card>
      </div>

      {/* 用户统计 */}
      {userStats.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              成员报价统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead className="text-right">报价次数</TableHead>
                  <TableHead className="text-right">报价总额</TableHead>
                  <TableHead className="text-right">平均报价</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStats.map((stat) => (
                  <TableRow key={stat.user_id}>
                    <TableCell className="font-medium">{stat.real_name}</TableCell>
                    <TableCell>{stat.username}</TableCell>
                    <TableCell className="text-right">{stat.total_quotes}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stat.total_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stat.avg_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 报价记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            报价记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无报价记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>客户名称</TableHead>
                  <TableHead>报价人</TableHead>
                  <TableHead>项目类型</TableHead>
                  <TableHead className="text-right">设备数量</TableHead>
                  <TableHead className="text-right">报价金额</TableHead>
                  <TableHead>报价时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.client_name}</TableCell>
                    <TableCell>{record.real_name || record.username}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {record.quote_type === 'full' ? '完整版' : '简版'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{record.device_count}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(record.total_amount)}
                    </TableCell>
                    <TableCell>{new Date(record.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetail(record.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteRecord(record.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
