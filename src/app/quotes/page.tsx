'use client';

import { useState, useMemo, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { getAuthHeader } from '@/contexts/user-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Eye,
  Edit2,
  Copy,
  Share2,
  Trash2,
  CheckCircle,
  Download,
  ChevronDown,
  ArrowUpDown,
  FileText,
  Send,
  Archive,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { downloadAsPDF } from '@/lib/export-utils';

// 报价单状态
type QuoteStatus = 'draft' | 'pending_review' | 'approved' | 'sent' | 'archived';

// 报价单接口
interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  project_name: string;
  total: number;
  total_amount: number;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
  created_by: string;
  valid_until?: string;
}

interface ActionMenuItem {
  label: string;
  icon: LucideIcon | null;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

// 状态配置
const STATUS_CONFIG: Record<QuoteStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
  draft: { label: '草稿', variant: 'secondary', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  pending_review: { label: '待审核', variant: 'secondary', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  approved: { label: '已批准', variant: 'default', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  sent: { label: '已发送', variant: 'outline', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  archived: { label: '已归档', variant: 'secondary', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

// Tab配置
const TABS = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'pending_review', label: '待审核' },
  { value: 'approved', label: '已批准' },
  { value: 'sent', label: '已发送' },
  { value: 'archived', label: '已归档' },
];

// 格式化金额
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// 格式化日期
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 排序配置
type SortField = 'created_at' | 'updated_at' | 'total_amount' | 'quote_number';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export default function QuotesPage() {
  const router = useRouter();
  const { token } = useUser();

  // 状态
  const [activeTab, setActiveTab] = useState('all');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'updated_at', order: 'desc' });
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 过滤和排序后的报价单
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const filteredQuotes = useMemo(() => {
    let result = [...quotes];

    // 按Tab过滤
    if (activeTab !== 'all') {
      result = result.filter((q) => q.status === activeTab);
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (q) =>
          q.quote_number.toLowerCase().includes(query) ||
          q.client_name.toLowerCase().includes(query) ||
          q.project_name.toLowerCase().includes(query)
      );
    }

    // 日期范围过滤
    if (dateRange.start) {
      result = result.filter((q) => q.created_at >= dateRange.start);
    }
    if (dateRange.end) {
      result = result.filter((q) => q.created_at <= dateRange.end);
    }

    // 排序
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortConfig.field) {
        case 'total_amount':
          aVal = a.total_amount;
          bVal = b.total_amount;
          break;
        case 'quote_number':
          aVal = a.quote_number;
          bVal = b.quote_number;
          break;
        case 'created_at':
          aVal = a.created_at;
          bVal = b.created_at;
          break;
        case 'updated_at':
        default:
          aVal = a.updated_at;
          bVal = b.updated_at;
      }

      if (aVal < bVal) return sortConfig.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.order === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [quotes, activeTab, searchQuery, dateRange, sortConfig]);

  // 切换排序
  const handleSort = (field: SortField) => {
    setSortConfig((prev) =>
      prev.field === field
        ? { field, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { field, order: 'desc' }
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuotes.map((q) => q.id)));
    }
  };

  // 切换单选
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // 批量批准
  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    setIsLoading(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/quotes/${encodeURIComponent(id)}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
          }).then((r) => r.json())
        )
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const failed = selectedIds.size - succeeded;
      toast.success(`批量批准完成：成功 ${succeeded}，失败 ${failed}`);
      await loadQuotes();
      setSelectedIds(new Set());
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error('批量批准失败：' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 批量导出（CSV）
  const handleBatchExport = async () => {
    if (selectedIds.size === 0) return;
    setIsLoading(true);
    try {
      const exportRows = filteredQuotes
        .filter((q) => selectedIds.has(q.id))
        .map((q) => ({
          报价编号: q.quote_number,
          客户: q.client_name,
          项目: q.project_name,
          金额: q.total,
          状态: q.status,
          创建时间: q.created_at,
        }));
      const headers = Object.keys(exportRows[0] || {}) as Array<keyof typeof exportRows[0]>;
      const csv = [
        headers.join(','),
        ...exportRows.map((row) =>
          headers.map((h) => `"${String((row as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `报价单导出_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${exportRows.length} 条报价`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error('批量导出失败：' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 批量归档
  const handleBatchArchive = async () => {
    if (selectedIds.size === 0) return;
    setIsLoading(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/quotes/${encodeURIComponent(id)}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'archive' }),
          }).then((r) => r.json())
        )
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const failed = selectedIds.size - succeeded;
      toast.success(`批量归档完成：成功 ${succeeded}，失败 ${failed}`);
      await loadQuotes();
      setSelectedIds(new Set());
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error('批量归档失败：' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 复制报价
  const handleCopyQuote = (quote: Quote) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(quote.quote_number).then(
        () => toast.success(`报价编号已复制：${quote.quote_number}`),
        () => toast.error('复制失败，请手动复制')
      );
    } else {
      toast.info(`报价编号：${quote.quote_number}`);
    }
  };

  // 分享报价（生成分享链接）
  const handleShareQuote = async (quote: Quote) => {
    try {
      const response = await fetch('/api/quotes/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.id, expiryDays: 7 }),
      });
      const data = await response.json();
      if (data.success && data.data?.shareUrl) {
        const shareUrl = `${window.location.origin}${data.data.shareUrl}`;
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
          toast.success('分享链接已复制到剪贴板');
        } else {
          toast.info(`分享链接：${shareUrl}`);
        }
      } else {
        toast.error(data.error || '生成分享链接失败');
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error('分享失败：' + err.message);
    }
  };

  // 单条操作：批准
  const handleApproveQuote = async (quote: Quote) => {
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quote.id)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`已批准：${quote.quote_number}`);
        void loadQuotes();
      } else {
        toast.error(data.error || '批准失败');
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error('批准失败：' + err.message);
    }
  };

  // 单条操作：发送
  const handleSendQuote = async (quote: Quote) => {
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quote.id)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`已发送：${quote.quote_number}`);
        void loadQuotes();
      } else {
        toast.error(data.error || '发送失败');
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error('发送失败：' + err.message);
    }
  };

  // 单条操作：导出 PDF
  const handleExportPdf = async (quote: Quote) => {
    try {
      const escapeHtml = (value: string) => value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
      const html = `
        <html><body>
          <h1 class="title">报价单</h1>
          <table class="info-table">
            <tr><td class="label">报价编号</td><td>${escapeHtml(quote.quote_number)}</td></tr>
            <tr><td class="label">客户名称</td><td>${escapeHtml(quote.client_name)}</td></tr>
            <tr><td class="label">项目名称</td><td>${escapeHtml(quote.project_name)}</td></tr>
            <tr><td class="label">报价金额</td><td>${escapeHtml(formatCurrency(quote.total_amount))}</td></tr>
            <tr><td class="label">状态</td><td>${escapeHtml(STATUS_CONFIG[quote.status]?.label || quote.status)}</td></tr>
            <tr><td class="label">创建时间</td><td>${escapeHtml(formatDate(quote.created_at))}</td></tr>
          </table>
        </body></html>`;
      await downloadAsPDF(html, `${quote.quote_number}.pdf`);
      toast.success(`已导出：${quote.quote_number}.pdf`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error('导出失败：' + err.message);
    }
  };

  // 单条操作：删除
  const handleDeleteQuote = async (quote: Quote) => {
    if (!window.confirm(`确认删除报价 ${quote.quote_number}？此操作不可恢复。`)) {
      return;
    }
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quote.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`已删除：${quote.quote_number}`);
        void loadQuotes();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error('删除失败：' + err.message);
    }
  };

  // 获取操作菜单项
  const getActionItems = (quote: Quote): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [
      {
        label: '查看详情',
        icon: Eye,
        onClick: () => router.push(`/quotes/${encodeURIComponent(quote.id)}`),
      },
      {
        label: '编辑',
        icon: Edit2,
        onClick: () => router.push(`/quotes/${encodeURIComponent(quote.id)}/edit`),
        disabled: quote.status === 'archived',
      },
      {
        label: '复制编号',
        icon: Copy,
        onClick: () => handleCopyQuote(quote),
      },
      {
        label: '分享链接',
        icon: Share2,
        onClick: () => handleShareQuote(quote),
      },
    ];

    if (quote.status === 'pending_review') {
      items.push({
        label: '批准报价',
        icon: CheckCircle,
        onClick: () => handleApproveQuote(quote),
      });
    }

    if (quote.status === 'approved') {
      items.push({
        label: '发送报价',
        icon: Send,
        onClick: () => handleSendQuote(quote),
      });
    }

    if (quote.status === 'sent' || quote.status === 'approved') {
      items.push({
        label: '导出PDF',
        icon: Download,
        onClick: () => handleExportPdf(quote),
      });
    }

    items.push(
      { label: 'divider', icon: null, onClick: () => {} },
      {
        label: '删除',
        icon: Trash2,
        onClick: () => handleDeleteQuote(quote),
        variant: 'destructive',
        disabled: quote.status === 'sent',
      }
    );

    return items;
  };

  // 获取Tab计数
  const getTabCount = (tabValue: string) => {
    if (tabValue === 'all') return quotes.length;
    return quotes.filter((q) => q.status === tabValue).length;
  };

  // 清除过滤
  const clearFilters = () => {
    setSearchQuery('');
    setDateRange({ start: '', end: '' });
  };

  const hasActiveFilters = searchQuery || dateRange.start || dateRange.end;

  // ============ 加载报价数据 ============
  const loadQuotes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/quotes', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setQuotes(data.data);
      } else {
        toast.error('加载报价失败：' + (data.error ?? '返回数据格式异常'));
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error('加载报价失败：' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6" />
            报价管理
          </h1>
          <p className="text-muted-foreground mt-1">管理所有报价单，支持批量操作</p>
        </div>
        <Button
          onClick={() => router.push('/quotes/new')}
        >
          <Plus className="h-4 w-4 mr-2" />
          新建报价
        </Button>
      </div>

      {/* 过滤和搜索栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* 搜索和操作栏 */}
            <div className="flex items-center gap-4">
              {/* 搜索框 */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索报价单号、客户名称、项目名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* 日期过滤 */}
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                  className="w-36"
                  placeholder="开始日期"
                />
                <span className="text-muted-foreground">至</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                  className="w-36"
                  placeholder="结束日期"
                />
              </div>

              {/* 过滤按钮 */}
              <Button
                variant={showFilters ? 'default' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                筛选
                {hasActiveFilters && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                    {(searchQuery ? 1 : 0) + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0)}
                  </span>
                )}
              </Button>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  清除
                </Button>
              )}
            </div>

            {/* 批量操作栏 */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">
                  已选择 {selectedIds.size} 项
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleBatchApprove}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    批量批准
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBatchExport}>
                    <Download className="h-4 w-4 mr-1" />
                    批量导出
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBatchArchive}>
                    <Archive className="h-4 w-4 mr-1" />
                    批量归档
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  取消选择
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab列表 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 justify-center px-1"
              >
                {getTabCount(tab.value)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab内容 */}
        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            filteredQuotes.length > 0 &&
                            selectedIds.size === filteredQuotes.length
                          }
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-36">
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => handleSort('quote_number')}
                        >
                          报价单号
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>客户名称</TableHead>
                      <TableHead>项目名称</TableHead>
                      <TableHead className="w-32">
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => handleSort('total_amount')}
                        >
                          报价金额
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-28">
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => handleSort('created_at')}
                        >
                          创建日期
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="w-28">
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => handleSort('updated_at')}
                        >
                          更新日期
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="w-12">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-muted-foreground">暂无数据</p>
                            <Button variant="outline" onClick={() => router.push('/quotes/new')}>
                              创建第一个报价单
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuotes.map((quote) => (
                        <TableRow key={quote.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(quote.id)}
                              onCheckedChange={() => toggleSelect(quote.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {quote.quote_number}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {quote.client_name}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {quote.project_name}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(quote.total_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_CONFIG[quote.status].color}>
                              {STATUS_CONFIG[quote.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(quote.created_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(quote.updated_at)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getActionItems(quote).map((item, index) =>
                                  item.label === 'divider' ? (
                                    <DropdownMenuSeparator key={index} />
                                  ) : (
                                    <DropdownMenuItem
                                      key={index}
                                      onClick={item.onClick}
                                      disabled={item.disabled}
                                    >
                                      {item.icon && <item.icon className="h-4 w-4 mr-2" />}
                                      {item.label}
                                    </DropdownMenuItem>
                                  )
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
