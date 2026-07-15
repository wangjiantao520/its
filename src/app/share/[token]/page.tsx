'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuoteSummary } from '@/lib/quote-summary';

export default function SharedQuotePage() {
  const params = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/share/${encodeURIComponent(params.token)}`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || '加载失败');
        setQuote(result.data.quote);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '加载失败');
      }
    };
    void load();
  }, [params.token]);

  if (error) return <div className="mx-auto max-w-xl p-10 text-center text-destructive">{error}</div>;
  if (!quote) return <div className="p-10 text-center text-muted-foreground">正在加载报价...</div>;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6 print:p-0">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />打印或保存PDF</Button>
      </div>
      <Card>
        <CardHeader className="border-b text-center">
          <CardTitle className="text-2xl">报价单</CardTitle>
          <p className="font-mono text-sm text-muted-foreground">{quote.quoteNumber}</p>
        </CardHeader>
        <CardContent className="space-y-6 py-8">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold">{quote.projectName}</h1>
            <Badge>{quote.status}</Badge>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Info label="客户名称" value={quote.clientName} />
            <Info label="报价类型" value={quote.source === 'engineering' ? '工程报价' : '维保报价'} />
            <Info label="报价金额" value={`¥${quote.total.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`} />
            <Info label="报价日期" value={quote.createdAt || '-'} />
          </div>
          <p className="border-t pt-5 text-xs text-muted-foreground">本页面由 ITS 报价系统生成，仅供获授权的接收方查看。</p>
        </CardContent>
      </Card>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>;
}
