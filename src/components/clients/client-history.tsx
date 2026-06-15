'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Search,
  FileText,
  Eye,
  Copy,
  FileDown,
  Calendar,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface QuoteRecord {
  id: number;
  quote_no: string;
  quote_type: string;
  project_name: string;
  total_amount: number;
  tax_amount: number;
  net_amount: number;
  status: 'draft' | 'submitted' | 'success' | 'expired';
  created_at: string;
  created_by: string;
}

interface ClientHistoryProps {
  clientId?: number;
  token: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  success: '已成交',
  expired: '已失效',
};

const STATUS_COLORS: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  submitted: 'default',
  success: 'outline',
  expired: 'destructive',
};

export function ClientHistory({ clientId, token }: ClientHistoryProps) {
  const [records, setRecords] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [total, setTotal] = useState(0);

  const fetchHistory = useCallback(async () => {
    if (!token || !clientId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        client_id: String(clientId),
        page: String(page),
        page_size: String(pageSize),
        search,
        status: statusFilter === 'all' ? '' : statusFilter,
      });
      const res = await fetch(`/api/clients/${clientId}/quotes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setRecords(data.data?.items ?? data.data ?? []);
        setTotal(data.data?.total ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch client quote history:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId, token, page, search, statusFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // Export a single quote as Excel
  const handleExport = (record: QuoteRecord) => {
    const data = [
      { 报价单号: record.quote_no, 报价类型: record.quote_type, 项目名称: record.project_name },
      { 总价: record.total_amount, 税额: record.tax_amount, 不含税金额: record.net_amount },
      { 状态: STATUS_LABELS[record.status] ?? record.status, 创建时间: record.created_at, 创建人: record.created_by },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '报价记录');
    XLSX.writeFile(wb, `${record.quote_no}_${record.project_name}.xlsx`);
  };

  // Reuse a historical quote (navigate or open detail)
  const handleReuse = (record: QuoteRecord) => {
    // In a real app, this would navigate to a quote editor pre-populated with this data.
    // For now, we export the data so the user can reuse it.
    handleExport(record);
  };

  const filtered = records;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">总报价数</CardTitle>
            <FileText className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">已成交</CardTitle>
            <Badge variant="outline" className="text-xs">成交</Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-bold">{records.filter((r) => r.status === 'success').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">已提交</CardTitle>
            <Badge variant="default" className="text-xs">已提交</Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-bold">{records.filter((r) => r.status === 'submitted').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">总金额</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-bold">
              ¥{records.reduce((sum, r) => sum + r.total_amount, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索项目名称..."
            className="pl-9 w-[200px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="submitted">已提交</option>
            <option value="success">已成交</option>
            <option value="expired">已失效</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchHistory} className="gap-1">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>报价单号</TableHead>
            <TableHead>报价类型</TableHead>
            <TableHead>项目名称</TableHead>
            <TableHead>总价</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="w-[160px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载中...
                </div>
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                暂无历史报价记录
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-mono text-xs">{record.quote_no}</TableCell>
                <TableCell>
                  <Badge variant="outline">{record.quote_type}</Badge>
                </TableCell>
                <TableCell className="max-w-[180px] truncate" title={record.project_name}>
                  {record.project_name}
                </TableCell>
                <TableCell className="font-semibold">
                  ¥{record.total_amount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLORS[record.status] ?? 'secondary'}>
                    {STATUS_LABELS[record.status] ?? record.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <Calendar className="h-3 w-3" />
                    {record.created_at}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" title="查看" onClick={() => handleReuse(record)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="复制并新建" onClick={() => handleReuse(record)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="导出Excel"
                      onClick={() => handleExport(record)}
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {total} 条，第 {page}/{totalPages} 页
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一页
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
