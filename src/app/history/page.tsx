'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, FileText, Eye, Copy, FileDown, Calendar, Trash2, Download, FileSpreadsheet, Lock, History } from 'lucide-react';
import * as XLSX from 'xlsx';

// 报价记录类型
interface QuoteRecord {
  id: number;
  quoteNo: string;
  quoteType: string;
  customerName: string;
  projectName: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  status: string;
  createdAt: string;
  createdBy: string;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  '草稿': 'secondary',
  '已提交': 'default',
  '已成交': 'default',
  '已失效': 'destructive',
};

export default function HistoryPage() {
  const [records, setRecords] = useState<QuoteRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<number | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // 过滤后的记录
  const filteredRecords = records.filter(record => {
    const matchesSearch = !searchQuery ||
      record.customerName.includes(searchQuery) ||
      record.projectName.includes(searchQuery);
    const matchesType = typeFilter === 'all' || record.quoteType === typeFilter;
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // 导出单条记录为Excel
  const exportSingleRecord = (record: QuoteRecord) => {
    const data = [
      {
        '报价单号': record.quoteNo,
        '报价类型': record.quoteType,
        '客户名称': record.customerName,
        '项目名称': record.projectName,
        '总价': record.totalAmount,
        '税额': record.taxAmount,
        '不含税金额': record.netAmount,
        '状态': record.status,
        '创建时间': record.createdAt,
        '创建人': record.createdBy,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '报价记录');
    XLSX.writeFile(workbook, `${record.quoteNo}_${record.customerName}.xlsx`);
  };

  // 导出所有记录为Excel
  const exportAllRecords = () => {
    const data = filteredRecords.map(record => ({
      '报价单号': record.quoteNo,
      '报价类型': record.quoteType,
      '客户名称': record.customerName,
      '项目名称': record.projectName,
      '总价': record.totalAmount,
      '税额': record.taxAmount,
      '不含税金额': record.netAmount,
      '状态': record.status,
      '创建时间': record.createdAt,
      '创建人': record.createdBy,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '报价记录');
    XLSX.writeFile(workbook, '历史报价记录.xlsx');
  };

  // 确认删除记录
  const confirmDelete = (id: number) => {
    setRecordToDelete(id);
    setDeletePassword('');
    setDeleteError('');
    setPasswordDialogOpen(true);
  };

  // 验证密码并删除
  const verifyPasswordAndDelete = () => {
    const correctPassword = 'ecloud10086';

    if (deletePassword === correctPassword) {
      if (recordToDelete) {
        setRecords(records.filter(record => record.id !== recordToDelete));
      }
      setPasswordDialogOpen(false);
      setRecordToDelete(null);
      setDeletePassword('');
      setDeleteError('');
    } else {
      setDeleteError('密码错误，请重新输入');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">历史记录</h1>
        <p className="text-muted-foreground mt-1">查看和管理历史报价记录</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>报价记录</CardTitle>
              <CardDescription>共 {filteredRecords.length} 条记录</CardDescription>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索客户名称或项目名称"
                  className="w-[250px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="报价类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="工程报价">工程报价</SelectItem>
                  <SelectItem value="维保报价">维保报价</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="草稿">草稿</SelectItem>
                  <SelectItem value="已提交">已提交</SelectItem>
                  <SelectItem value="已成交">已成交</SelectItem>
                  <SelectItem value="已失效">已失效</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportAllRecords} variant="outline" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                导出全部
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>报价单号</TableHead>
                  <TableHead>报价类型</TableHead>
                  <TableHead>客户名称</TableHead>
                  <TableHead>项目名称</TableHead>
                  <TableHead>总价</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>创建人</TableHead>
                  <TableHead className="w-[220px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono">{record.quoteNo}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {record.quoteType}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.customerName}</TableCell>
                    <TableCell>{record.projectName}</TableCell>
                    <TableCell className="font-semibold">
                      ¥{record.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[record.status] ?? 'default'}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {record.createdAt}
                      </div>
                    </TableCell>
                    <TableCell>{record.createdBy}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="查看">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="复制">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="导出Excel"
                          onClick={() => exportSingleRecord(record)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="删除"
                          onClick={() => confirmDelete(record.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无历史记录</h3>
              <p className="text-sm text-muted-foreground">
                暂无报价记录，创建报价后将显示在这里
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 密码验证对话框 */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              删除验证
            </DialogTitle>
            <DialogDescription>
              删除报价记录需要验证二级密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">二级密码</label>
              <Input
                type="password"
                placeholder="请输入二级密码"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    verifyPasswordAndDelete();
                  }
                }}
              />
              {deleteError && (
                <p className="text-sm text-red-600">{deleteError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPasswordDialogOpen(false);
              setRecordToDelete(null);
              setDeletePassword('');
              setDeleteError('');
            }}>
              取消
            </Button>
            <Button variant="destructive" onClick={verifyPasswordAndDelete}>
              验证并删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 统计卡片 - 仅在有数据时显示 */}
      {records.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总报价数
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{records.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                已成交
              </CardTitle>
              <div className="h-4 w-4 rounded-full bg-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {records.filter(r => r.status === '已成交').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                工程报价
              </CardTitle>
              <Badge variant="outline">工程</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {records.filter(r => r.quoteType === '工程报价').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                维保报价
              </CardTitle>
              <Badge variant="outline">维保</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {records.filter(r => r.quoteType === '维保报价').length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
