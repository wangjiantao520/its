'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, FilePlus2, Library, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

import { apiFetch } from '@/lib/api-fetch';
import { useUser } from '@/contexts/user-context';
import { QuoteEditor, useEmptyQuoteData } from '@/components/quote-library/quote-editor';
import type { QuoteData } from '@/lib/quote-library-types';

export default function NewQuoteLibraryPage() {
  const router = useRouter();
  const { user } = useUser();
  const empty = useEmptyQuoteData();

  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quoteData, setQuoteData] = useState<QuoteData>(empty);
  const [totalAmount, setTotalAmount] = useState(0);

  if (user && user.role !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>无权访问</CardTitle>
          <CardDescription>仅管理员可创建报价资料库记录。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const submit = async () => {
    if (!description.trim()) {
      toast.error('请填写项目简述');
      return;
    }
    if (quoteData.summary.items.length === 0) {
      toast.error('请至少填写一条报价明细');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('client_name', clientName);
      form.append('project_name', projectName);
      form.append('project_description', description);
      form.append('is_published', String(isPublished));
      form.append('quote_data', JSON.stringify(quoteData));
      form.append('total_amount', totalAmount.toFixed(2));

      const result = await apiFetch<{ id: string }>('/api/quote-library', { method: 'POST', body: form });
      if (!result.success || !result.data) throw new Error(result.error || '保存失败');
      toast.success('报价资料库记录创建成功，请到详情页继续上传附件');
      router.push(`/admin/quote-library/${result.data.id}/edit`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="新增报价资料"
        description="填写项目基本信息与报价单。保存后可在编辑页上传现场照片与其他资料。"
        icon={<FilePlus2 className="h-5 w-5" />}
        backHref="/admin/quote-library"
      />

      <Card className="overflow-hidden border-primary/15 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Library className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">基础信息</CardTitle>
              <CardDescription>项目简述必填；客户/项目名称用于检索与汇总。</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="客户名称（可选）" hint="用于资料库检索与列表展示">
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="如：康海物流"
                className="h-10"
              />
            </Field>
            <Field label="项目名称（可选）" hint="如：固话线路整改">
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="如：固话线路整改"
                className="h-10"
              />
            </Field>
          </div>
          <Field
            label="项目简述"
            required
            hint="由上传人对所承接的项目内容进行简单描述，主要是要做什么！"
          >
            <Textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例：本次为康海物流园内 4 栋仓库的固话线路整改工程，涉及 80 个信息点位的跳线及配线架更新……"
              className="resize-y leading-relaxed"
            />
          </Field>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} id="publish" />
            <Label htmlFor="publish" className="cursor-pointer">
              <span className="font-medium">对用户端可见</span>
              <span className="block text-xs text-muted-foreground">关闭后仅管理员可在列表查看，用户端不可见。</span>
            </Label>
            <Badge variant={isPublished ? 'default' : 'secondary'} className="ml-auto">
              {isPublished ? '将发布' : '暂存草稿'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <QuoteEditor
        initialData={empty}
        initialTotalAmount={0}
        onChange={(data, total) => {
          setQuoteData(data);
          setTotalAmount(total);
        }}
      />

      <div className="sticky bottom-0 -mx-3 md:-mx-6 px-3 md:px-6 py-3 bg-background/80 backdrop-blur border-t flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="ghost">
          <Link href="/admin/quote-library">
            <ArrowLeft className="h-4 w-4 mr-1" />
            取消
          </Link>
        </Button>
        <Button onClick={submit} disabled={submitting} className="min-w-[140px]">
          <Save className="h-4 w-4 mr-1" />
          {submitting ? '保存中…' : '保存基础信息'}
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

function PageHeader({
  title,
  description,
  icon,
  backHref,
  backLabel = '返回列表',
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  backHref: string;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-gradient-to-r from-primary/[0.03] via-primary/[0.07] to-transparent p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {backLabel}
            </Link>
          </Button>
          {action}
        </div>
      </div>
    </div>
  );
}