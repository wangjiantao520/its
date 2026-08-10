'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Library, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api-fetch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { QuoteLibraryListResponse, QuoteLibraryRecord } from '@/lib/quote-library-types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value || 0);
}
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN');
}

export default function QuoteLibraryListPage() {
  const router = useRouter();
  const [records, setRecords] = useState<QuoteLibraryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (keyword.trim()) params.set('q', keyword.trim());
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
  }, [page, pageSize, keyword]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Library className="h-5 w-5" />报价资料库</h1>
        <p className="text-sm text-muted-foreground">浏览历史项目报价资料，支持查看项目简述、报价单与附件。</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索标题 / 客户 / 项目名称" />
            </div>
            <Button variant="outline" onClick={() => { setPage(1); void load(); }}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>资料列表</CardTitle>
          <CardDescription>共 {total} 条记录</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>项目</TableHead>
                <TableHead className="text-right">含税合计</TableHead>
                <TableHead>更新时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    加载中…
                  </TableCell>
                </TableRow>
              )}
              {!loading && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">暂无资料</TableCell>
                </TableRow>
              )}
              {records.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/quote-library/${r.id}`)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {r.title || '-'}
                      {!r.is_published && <Badge variant="secondary">未发布</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{r.client_name || '-'}</TableCell>
                  <TableCell>{r.project_name || '-'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.total_amount)}</TableCell>
                  <TableCell>{formatDate(r.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex items-center justify-end gap-2 p-4 text-sm text-muted-foreground">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
          <span>{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</Button>
        </div>
      </Card>
    </div>
  );
}