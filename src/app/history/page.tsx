'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Eye, FileDown, FileSpreadsheet, History, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface QuoteRecord {
  id: string;
  quote_number: string;
  quote_type: string;
  client_name: string;
  project_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  created_by_name: string;
}

const TYPE_LABELS: Record<string, string> = {
  engineering: '工程报价',
  maintenance: '维保报价',
  quotation: '综合报价',
};

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/quotes?page_size=100');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '加载失败');
      setRecords(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载历史记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const filteredRecords = useMemo(() => records.filter((record) => {
    const query = searchQuery.trim().toLocaleLowerCase('zh-CN');
    const matchesSearch = !query || [record.client_name, record.project_name, record.quote_number]
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(query));
    return matchesSearch &&
      (typeFilter === 'all' || record.quote_type === typeFilter) &&
      (statusFilter === 'all' || record.status === statusFilter);
  }), [records, searchQuery, statusFilter, typeFilter]);

  const exportRecords = (items: QuoteRecord[], filename: string) => {
    if (items.length === 0) {
      toast.info('没有可导出的记录');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(items.map((record) => ({
      报价单号: record.quote_number,
      报价类型: TYPE_LABELS[record.quote_type] || record.quote_type,
      客户名称: record.client_name,
      项目名称: record.project_name,
      总价: record.total_amount,
      状态: record.status,
      创建时间: record.created_at,
      创建人: record.created_by_name,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '报价记录');
    XLSX.writeFile(workbook, filename);
  };

  const deleteRecord = async (record: QuoteRecord) => {
    if (!window.confirm(`确定删除报价 ${record.quote_number}？此操作不可恢复。`)) return;
    const response = await fetch(`/api/quotes/${encodeURIComponent(record.id)}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.success) {
      toast.error(result.error || '删除失败');
      return;
    }
    toast.success('报价已删除');
    await loadRecords();
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">历史记录</h1><p className="mt-1 text-muted-foreground">查看和管理全部历史报价</p></div>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><CardTitle>报价记录</CardTitle><CardDescription>共 {filteredRecords.length} 条记录</CardDescription></div>
            <div className="flex flex-wrap gap-2">
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="w-64 pl-9" placeholder="搜索编号、客户或项目" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div>
              <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部类型</SelectItem><SelectItem value="engineering">工程报价</SelectItem><SelectItem value="maintenance">维保报价</SelectItem><SelectItem value="quotation">综合报价</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="draft">草稿</SelectItem><SelectItem value="pending_review">待审核</SelectItem><SelectItem value="approved">已批准</SelectItem><SelectItem value="sent">已发送</SelectItem><SelectItem value="archived">已归档</SelectItem></SelectContent></Select>
              <Button variant="outline" onClick={() => exportRecords(filteredRecords, '历史报价记录.xlsx')}><FileSpreadsheet className="mr-2 h-4 w-4" />导出全部</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-16 text-center text-muted-foreground">加载中...</div> : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground"><History className="mb-3 h-12 w-12" />暂无历史记录</div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>报价单号</TableHead><TableHead>类型</TableHead><TableHead>客户</TableHead><TableHead>项目</TableHead><TableHead className="text-right">金额</TableHead><TableHead>状态</TableHead><TableHead>创建时间</TableHead><TableHead>创建人</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
              <TableBody>{filteredRecords.map((record) => (
                <TableRow key={record.id}><TableCell className="font-mono">{record.quote_number}</TableCell><TableCell><Badge variant="outline">{TYPE_LABELS[record.quote_type] || record.quote_type}</Badge></TableCell><TableCell>{record.client_name}</TableCell><TableCell>{record.project_name}</TableCell><TableCell className="text-right font-semibold">¥{record.total_amount.toLocaleString('zh-CN')}</TableCell><TableCell><Badge variant="secondary">{record.status}</Badge></TableCell><TableCell>{record.created_at}</TableCell><TableCell>{record.created_by_name || '-'}</TableCell><TableCell><div className="flex gap-1">
                  <Button variant="ghost" size="icon" title="查看" onClick={() => router.push(`/quotes/${encodeURIComponent(record.id)}`)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="复制编号" onClick={async () => { await navigator.clipboard.writeText(record.quote_number); toast.success('报价编号已复制'); }}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="导出Excel" onClick={() => exportRecords([record], `${record.quote_number}.xlsx`)}><FileDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="删除" className="text-destructive" onClick={() => void deleteRecord(record)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell></TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
