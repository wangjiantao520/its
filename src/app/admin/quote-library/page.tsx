'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Eye,
  Plus,
  Search,
  Trash2,
  Edit2,
  Library,
  Filter,
  Loader2,
} from 'lucide-react';

import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useUser } from '@/contexts/user-context';
import { useConfirm } from '@/hooks/use-confirm';
import type {
  QuoteLibraryListResponse,
  QuoteLibraryRecord,
} from '@/lib/quote-library-types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value || 0);
}
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN');
}

export default function AdminQuoteLibraryPage() {
  const router = useRouter();
  const { user } = useUser();
  const { confirm, ConfirmDialog } = useConfirm();
  const [records, setRecords] = useState<QuoteLibraryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [includeUnpublished, setIncludeUnpublished] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<QuoteLibraryRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (keyword.trim()) params.set('q', keyword.trim());
      if (includeUnpublished) params.set('all', 'true');
      const result = await apiFetch<QuoteLibraryListResponse>(`/api/quote-library?${params.toString()}`);
      if (!result.success || !result.data) throw new Error(result.error || '加载失败');
      setRecords(result.data.records);
      setTotal(result.data.total);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, includeUnpublished]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') return;
    void load();
  }, [user, load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const onDelete = async (record: QuoteLibraryRecord) => {
    const ok = await confirm({
      title: '删除报价资料',
      description: `确定要删除「${record.title}」吗？此操作不可恢复，相关附件也会被一并清理。`,
      confirmText: '删除',
      variant: 'destructive',
    });
    if (!ok) return;
    setPendingDelete(record);
    try {
      const result = await apiFetch(`/api/quote-library/${record.id}`, { method: 'DELETE' });
      if (!result.success) throw new Error(result.error || '删除失败');
      toast.success('已删除');
      void load();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      toast.error(message);
    } finally {
      setPendingDelete(null);
    }
  };

  if (user && user.role !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>无权访问</CardTitle>
          <CardDescription>该页面仅对管理员开放。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Library className="h-5 w-5" />报价资料库</h1>
          <p className="text-sm text-muted-foreground">管理端维护项目简述、报价单与附件；用户端可浏览已发布记录。</p>
        </div>
        <Button onClick={() => router.push('/admin/quote-library/new')}>
          <Plus className="h-4 w-4 mr-1" />新增资料
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索标题 / 客户 / 项目名称" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Switch checked={includeUnpublished} onCheckedChange={setIncludeUnpublished} id="include-unpublished" />
              <Label htmlFor="include-unpublished" className="text-sm">包含未发布</Label>
            </div>
            <Button variant="outline" onClick={() => { setPage(1); void load(); }}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>项目</TableHead>
                <TableHead className="text-right">含税合计</TableHead>
                <TableHead>上传人</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    加载中…
                  </TableCell>
                </TableRow>
              )}
              {!loading && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">暂无资料</TableCell>
                </TableRow>
              )}
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title || '-'}</TableCell>
                  <TableCell>{r.client_name || '-'}</TableCell>
                  <TableCell>{r.project_name || '-'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.total_amount)}</TableCell>
                  <TableCell>{r.uploader_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_published ? 'default' : 'secondary'}>
                      {r.is_published ? '已发布' : '未发布'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(r.updated_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/quote-library/${r.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/quote-library/${r.id}/edit`)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex items-center justify-between p-4 text-sm text-muted-foreground">
          <span>共 {total} 条</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
            <span>{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</Button>
          </div>
        </div>
      </Card>

      {pendingDelete && (
        <Dialog open onOpenChange={(open) => !open && setPendingDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>正在删除…</DialogTitle>
              <DialogDescription>请稍候，正在清理「{pendingDelete.title}」的附件与数据。</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingDelete(null)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {ConfirmDialog as React.ReactElement}
    </div>
  );
}