'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Edit3, Library, Loader2, Save } from 'lucide-react';

import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

import { QuoteEditor } from '@/components/quote-library/quote-editor';
import { AttachmentUploader } from '@/components/quote-library/attachment-uploader';
import { useUser } from '@/contexts/user-context';
import type { QuoteData, QuoteLibraryAttachment, QuoteLibraryRecord } from '@/lib/quote-library-types';

export default function EditQuoteLibraryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user } = useUser();

  const [record, setRecord] = useState<QuoteLibraryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [attachments, setAttachments] = useState<QuoteLibraryAttachment[]>([]);
  const [removeIds, setRemoveIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await apiFetch<QuoteLibraryRecord>(`/api/quote-library/${id}`);
      if (!result.success || !result.data) throw new Error(result.error || '加载失败');
      const data = result.data;
      setRecord(data);
      setClientName(data.client_name ?? '');
      setProjectName(data.project_name ?? '');
      setDescription(data.project_description);
      setTitle(data.title);
      setIsPublished(data.is_published);
      setQuoteData(data.quote_data);
      setTotalAmount(data.total_amount);
      setAttachments(data.attachments ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    void load();
  }, [user, load]);

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

  const submit = async () => {
    if (!id || !record || !quoteData) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('client_name', clientName);
      form.append('project_name', projectName);
      form.append('project_description', description);
      form.append('title', title);
      form.append('is_published', String(isPublished));
      form.append('total_amount', totalAmount.toFixed(2));
      form.append('quote_data', JSON.stringify(quoteData));
      form.append('remove_attachment_ids', removeIds.join(','));

      const result = await apiFetch<QuoteLibraryRecord>(`/api/quote-library/${id}`, { method: 'PATCH', body: form });
      if (!result.success || !result.data) throw new Error(result.error || '保存失败');
      toast.success('已保存');
      const updated = result.data;
      setRecord(updated);
      setTitle(updated.title);
      setIsPublished(updated.is_published);
      setAttachments(updated.attachments ?? []);
      setRemoveIds([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !record || !quoteData) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        加载中…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-gradient-to-r from-primary/[0.03] via-primary/[0.07] to-transparent p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">编辑报价资料</h1>
                {!isPublished && <Badge variant="secondary">未发布</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                修改项目信息、报价单与附件；点击「保存」一次性提交所有改动。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href={`/quote-library/${record.id}`}>
                预览
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-9">
              <Link href="/admin/quote-library">
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回列表
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-primary/15 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Library className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">基础信息</CardTitle>
              <CardDescription>修改项目简述、标题与可见性。</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="标题" hint="默认 = 客户名-项目名">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10" />
            </Field>
            <Field label="含税合计（元）" hint="随明细自动计算，亦可手动覆盖">
              <Input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
                step="0.01"
                className="h-10 tabular-nums"
              />
            </Field>
            <Field label="客户名称">
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="h-10" />
            </Field>
            <Field label="项目名称">
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="h-10" />
            </Field>
          </div>
          <Field label="项目简述" required>
            <Textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-y leading-relaxed"
            />
          </Field>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} id="publish" />
            <Label htmlFor="publish" className="cursor-pointer">
              <span className="font-medium">对用户端可见</span>
              <span className="block text-xs text-muted-foreground">关闭后仅管理员可见。</span>
            </Label>
            <Badge variant={isPublished ? 'default' : 'secondary'} className="ml-auto">
              {isPublished ? '已发布' : '未发布'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <QuoteEditor
        initialData={quoteData}
        initialTotalAmount={totalAmount}
        onChange={(data, total) => {
          setQuoteData(data);
          setTotalAmount(total);
        }}
      />

      <AttachmentUploader
        libraryId={id}
        initialAttachments={attachments}
        onChange={(next, ids) => {
          setAttachments(next);
          setRemoveIds(ids);
        }}
      />

      <div className="sticky bottom-0 -mx-3 md:-mx-6 px-3 md:px-6 py-3 bg-background/80 backdrop-blur border-t flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="ghost">
          <Link href="/admin/quote-library">
            <ArrowLeft className="h-4 w-4 mr-1" />
            取消
          </Link>
        </Button>
        <Button onClick={submit} disabled={saving} className="min-w-[140px]">
          <Save className="h-4 w-4 mr-1" />
          {saving ? '保存中…' : '保存全部修改'}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}