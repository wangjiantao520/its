'use client';

import { useState } from 'react';
import { Camera, FileText, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { apiFetch } from '@/lib/api-fetch';
import type {
  QuoteLibraryAttachment,
  QuoteLibraryAttachmentCategory,
} from '@/lib/quote-library-types';

interface AttachmentUploaderProps {
  libraryId?: string;
  initialAttachments: QuoteLibraryAttachment[];
  onChange: (attachments: QuoteLibraryAttachment[], removeIds: string[]) => void;
  disabled?: boolean;
}

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function AttachmentUploader({ libraryId, initialAttachments, onChange, disabled }: AttachmentUploaderProps) {
  const [attachments, setAttachments] = useState<QuoteLibraryAttachment[]>(initialAttachments);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState<{ survey: boolean; other: boolean }>({ survey: false, other: false });

  const upload = async (category: QuoteLibraryAttachmentCategory, files: File[]) => {
    if (files.length === 0 || !libraryId) return;
    setUploading((p) => ({ ...p, [category === 'survey_photo' ? 'survey' : 'other']: true }));
    try {
      const form = new FormData();
      for (const file of files) form.append(category === 'survey_photo' ? 'survey_photos' : 'other_files', file);
      form.append('remove_attachment_ids', '');
      const result = await apiFetch<{ new_attachments: QuoteLibraryAttachment[] }>(`/api/quote-library/${libraryId}`, {
        method: 'PATCH',
        body: form,
      });
      if (!result.success || !result.data) throw new Error(result.error || '上传失败');
      const added = result.data.new_attachments ?? [];
      const next = [...attachments, ...added];
      setAttachments(next);
      onChange(next, removeIds);
      toast.success(`已上传 ${added.length} 个附件`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败';
      toast.error(message);
    } finally {
      setUploading((p) => ({ ...p, [category === 'survey_photo' ? 'survey' : 'other']: false }));
    }
  };

  const markRemove = (id: string) => {
    const next = attachments.filter((a) => a.id !== id);
    setAttachments(next);
    setRemoveIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onChange(next, [...removeIds, id].filter((v, i, arr) => arr.indexOf(v) === i));
    toast.message('已标记删除，保存时生效');
  };

  const renderGroup = (category: QuoteLibraryAttachmentCategory, accept: string, label: string, Icon: typeof Camera) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
        <CardDescription>
          {category === 'survey_photo' ? '现场查勘照片（非必传），支持 JPG/PNG/WEBP/HEIC，单文件 ≤ 20MB' : '其他资料（非必传），支持 PDF/Word/Excel/压缩包/CAD 等，单文件 ≤ 20MB'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.filter((a) => a.category === category).map((a) => (
            <Badge key={a.id} variant="secondary" className="flex items-center gap-2 py-1 px-2">
              <span className="truncate max-w-[200px]" title={a.original_name}>{a.original_name}</span>
              <span className="text-xs text-muted-foreground">{formatSize(a.file_size)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => markRemove(a.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {attachments.filter((a) => a.category === category).length === 0 && (
            <span className="text-sm text-muted-foreground">暂无文件</span>
          )}
        </div>
        <label className="inline-flex">
          <input
            type="file"
            accept={accept}
            multiple
            className="hidden"
            disabled={disabled || !libraryId || uploading[category === 'survey_photo' ? 'survey' : 'other']}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              if (files.length > 0) void upload(category, files);
              e.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" asChild disabled={disabled || !libraryId}>
            <span className="cursor-pointer">
              <Upload className="h-4 w-4 mr-1" />
              选择文件
            </span>
          </Button>
        </label>
        {!libraryId && <p className="text-xs text-muted-foreground mt-2">提示：请先保存基础信息后再上传附件。</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {renderGroup('survey_photo', 'image/*', '现场查勘照片', Camera)}
      {renderGroup('other', '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.dwg,.dxf,.svg', '其他资料', FileText)}
    </div>
  );
}

export function AttachmentPreview({ attachments }: { attachments: QuoteLibraryAttachment[] }) {
  const photos = attachments.filter((a) => a.category === 'survey_photo');
  const others = attachments.filter((a) => a.category === 'other');
  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" />
              现场查勘照片
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.map((a) => (
                <a
                  key={a.id}
                  href={`/api/quote-library/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block border rounded overflow-hidden hover:shadow"
                >
                  <img src={`/api/quote-library/attachments/${a.id}`} alt={a.original_name} className="w-full h-32 object-cover" loading="lazy" />
                  <div className="text-xs p-2 truncate" title={a.original_name}>{a.original_name}</div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              其他资料
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {others.map((a) => (
                <li key={a.id} className="flex items-center justify-between border rounded px-3 py-2">
                  <a href={`/api/quote-library/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                    {a.original_name}
                  </a>
                  <span className="text-xs text-muted-foreground">{formatSize(a.file_size)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AttachmentSummary({ attachments }: { attachments: QuoteLibraryAttachment[] }) {
  return (
    <div className="flex gap-2 text-xs text-muted-foreground">
      <Label>附件：</Label>
      <span>现场照片 {attachments.filter((a) => a.category === 'survey_photo').length} 张，</span>
      <span>其他资料 {attachments.filter((a) => a.category === 'other').length} 份</span>
      <span className="hidden">{JSON.stringify(attachments)}</span>
      <Button type="button" variant="ghost" size="icon" className="hidden" aria-hidden>
        <Trash2 className="h-4 w-4" />
      </Button>
      <Input type="hidden" value="" readOnly />
    </div>
  );
}