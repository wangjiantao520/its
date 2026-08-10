'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Library, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { QuoteView } from '@/components/quote-library/quote-view';
import { AttachmentPreview } from '@/components/quote-library/attachment-uploader';
import { useUser } from '@/contexts/user-context';
import type { QuoteLibraryRecord } from '@/lib/quote-library-types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value || 0);
}

export default function QuoteLibraryDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user } = useUser();

  const [record, setRecord] = useState<QuoteLibraryRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await apiFetch<QuoteLibraryRecord>(`/api/quote-library/${id}`);
      if (!result.success || !result.data) throw new Error(result.error || '加载失败');
      setRecord(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading || !record) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        加载中…
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button asChild variant="ghost">
          <Link href="/quote-library">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回列表
          </Link>
        </Button>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => router.push(`/admin/quote-library/${record.id}/edit`)}>
              编辑
            </Button>
          )}
          <Button onClick={() => window.open(`/api/quote-library/${record.id}/export`, '_blank')}>
            <Download className="h-4 w-4 mr-1" />
            下载 Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Library className="h-5 w-5" />
              {record.title || '报价资料'}
            </CardTitle>
            <div className="flex items-center gap-2">
              {!record.is_published && <Badge variant="secondary">未发布</Badge>}
              <Badge variant="outline">{formatCurrency(record.total_amount)}</Badge>
            </div>
          </div>
          <CardDescription>
            客户：{record.client_name || '-'} · 项目：{record.project_name || '-'} · 上传人：{record.uploader_name || '-'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">项目简述</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{record.project_description}</p>
          </div>
        </CardContent>
      </Card>

      <QuoteView data={record.quote_data} />

      {record.attachments && record.attachments.length > 0 && (
        <AttachmentPreview attachments={record.attachments} />
      )}
    </div>
  );
}