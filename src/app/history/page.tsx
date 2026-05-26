'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, FileText, Eye, Copy, FileDown, Calendar, Trash2, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

// 模拟历史报价记录
const mockQuoteRecords = [
  {
    id: 1,
    quoteNo: 'BJ-2024-05001',
    quoteType: '工程报价',
    customerName: '宁德市第一中学',
    projectName: '校园监控系统升级',
    totalAmount: 156800,
    taxAmount: 18024,
    netAmount: 138776,
    status: '已成交',
    createdAt: '2024-05-20 10:30:00',
    createdBy: '张三',
  },
  {
    id: 2,
    quoteNo: 'BJ-2024-05002',
    quoteType: '维保报价',
    customerName: '宁德市医院',
    projectName: 'IT设备年度维保服务',
    totalAmount: 89600,
    taxAmount: 10304,
    netAmount: 79296,
    status: '已提交',
    createdAt: '2024-05-19 14:20:00',
    createdBy: '李四',
  },
  {
    id: 3,
    quoteNo: 'BJ-2024-05003',
    quoteType: '工程报价',
    customerName: '宁德市公安局',
    projectName: '综合布线系统',
    totalAmount: 234500,
    taxAmount: 26955,
    netAmount: 207545,
    status: '草稿',
    createdAt: '2024-05-18 09:15:00',
    createdBy: '张三',
  },
  {
    id: 4,
    quoteNo: 'BJ-2024-05004',
    quoteType: '维保报价',
    customerName: '宁德市企业服务中心',
    projectName: '监控系统维保',
    totalAmount: 45000,
    taxAmount: 5175,
    netAmount: 39825,
    status: '已失效',
    createdAt: '2024-05-15 16:45:00',
    createdBy: '王五',
  },
  {
    id: 5,
    quoteNo: 'BJ-2024-05005',
    quoteType: '工程报价',
    customerName: '宁德市图书馆',
    projectName: '网络设备安装',
    totalAmount: 78900,
    taxAmount: 9067,
    netAmount: 69833,
    status: '已成交',
    createdAt: '2024-05-12 11:00:00',
    createdBy: '李四',
  },
];

const statusColors: Record<string, string> = {
  '草稿': 'secondary',
  '已提交': 'default',
  '已成交': 'success',
  '已失效': 'destructive',
};

export default function HistoryPage() {
  const [records, setRecords] = useState(mockQuoteRecords);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<number | null>(null);

  // 导出单条记录为Excel
  const exportSingleRecord = (record: typeof mockQuoteRecords[0]) => {
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
    const data = records.map(record => ({
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
    setDeleteDialogOpen(true);
  };

  // 执行删除
  const executeDelete = () => {
    if (recordToDelete) {
      setRecords(records.filter(record => record.id !== recordToDelete));
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
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
              <CardDescription>共 {records.length} 条记录</CardDescription>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索客户名称或项目名称"
                  className="w-[250px]"
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="报价类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="engineering">工程报价</SelectItem>
                  <SelectItem value="maintenance">维保报价</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="submitted">已提交</SelectItem>
                  <SelectItem value="success">已成交</SelectItem>
                  <SelectItem value="expired">已失效</SelectItem>
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
              {records.map((record) => (
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
                    <Badge variant={statusColors[record.status] as any}>
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
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这条报价记录吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={executeDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 统计卡片 */}
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
    </div>
  );
}
