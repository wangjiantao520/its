'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuoteSummary } from '@/lib/quote-summary';

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<QuoteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/quotes/${encodeURIComponent(params.id)}`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || '加载失败');
        setQuote(result.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.id]);

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;
  if (!quote) return <div className="p-8 text-destructive">{error || '报价不存在'}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6 print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />返回
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(quote.quoteNumber);
              toast.success('报价编号已复制');
            }}
          >
            <Copy className="mr-2 h-4 w-4" />复制编号
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />打印或保存PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{quote.projectName}</CardTitle>
              <p className="mt-2 font-mono text-sm text-muted-foreground">{quote.quoteNumber}</p>
            </div>
            <Badge>{quote.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 py-6 sm:grid-cols-2">
          <Detail label="客户名称" value={quote.clientName} />
          <Detail label="报价类型" value={quote.source === 'engineering' ? '工程报价' : '维保报价'} />
          <Detail label="报价金额" value={`¥${quote.total.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`} />
          <Detail label="创建人" value={quote.createdByName || quote.createdBy || '-'} />
          <Detail label="创建时间" value={quote.createdAt || '-'} />
          <Detail label="更新时间" value={quote.updatedAt || '-'} />
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
