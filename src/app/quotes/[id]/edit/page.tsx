'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { QuoteSummary } from '@/lib/quote-summary';

export default function EditQuotePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ projectName: '', clientName: '', total: '' });

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/quotes/${encodeURIComponent(params.id)}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result.error || '加载失败');
        router.replace('/quotes');
        return;
      }
      const quote = result.data as QuoteSummary;
      setForm({ projectName: quote.projectName, clientName: quote.clientName, total: String(quote.total) });
      setLoading(false);
    };
    void load();
  }, [params.id, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(params.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, total: Number(form.total) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '保存失败');
      toast.success('报价已更新');
      router.push(`/quotes/${encodeURIComponent(params.id)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />返回</Button>
      <Card><CardHeader><CardTitle>编辑报价</CardTitle></CardHeader><CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2"><Label htmlFor="projectName">项目名称</Label><Input id="projectName" required value={form.projectName} onChange={(event) => setForm({ ...form, projectName: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="clientName">客户名称</Label><Input id="clientName" required value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="total">报价金额</Label><Input id="total" type="number" min="0" step="0.01" required value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} /></div>
          <Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? '保存中...' : '保存修改'}</Button>
        </form>
      </CardContent></Card>
    </div>
  );
}
