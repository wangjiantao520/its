import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import {
  buildStoredName,
  buildStoredPath,
  ensureDir,
  resolveSafeAbsolutePath,
  safeUnlink,
  toPublicUrl,
  uploadsDir,
  writeFile,
} from '@/lib/quote-library-storage';
import type {
  QuoteData,
  QuoteLibraryAttachment,
  QuoteLibraryAttachmentCategory,
  QuoteLibraryRecord,
} from '@/lib/quote-library-types';
import {
  MAX_ATTACHMENTS_PER_RECORD,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_QUOTE_DATA_BYTES,
  OTHER_FILE_MIME,
  SURVEY_PHOTO_MIME,
} from '@/lib/quote-library-types';

const ALLOWED_MIME_FOR_OTHER = new Set<string>(OTHER_FILE_MIME);
const ALLOWED_MIME_FOR_PHOTO = new Set<string>(SURVEY_PHOTO_MIME);
const PHOTO_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const OTHER_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|dwg|dxf|svg)$/i;

type RouteContext = { params: Promise<{ id: string }> };

interface Row extends Record<string, unknown> {
  id: string | number | bigint;
  user_id?: string | number | bigint | null;
  uploader_name?: string | null;
  title: string;
  client_name?: string | null;
  project_name?: string | null;
  project_description: string;
  quote_data: QuoteData | string;
  total_amount: string | number;
  currency: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface AttachmentRow extends Record<string, unknown> {
  id: string | number | bigint;
  category: QuoteLibraryAttachmentCategory;
  original_name: string;
  stored_path: string;
  mime_type?: string | null;
  file_size?: string | number | null;
  uploaded_by?: string | number | bigint | null;
  created_at: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function asNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function asBool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  if (typeof value === 'number') return value !== 0;
  return fallback;
}
function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function normalizeQuoteData(value: Row['quote_data']): QuoteData {
  if (typeof value === 'string') {
    try { return JSON.parse(value) as QuoteData; } catch { return { template: 'engineering-quote-v1', summary: { title: '', items: [], totals: { taxable_total: 0, tiejiang_taxable_total: 0, yidong_taxable_total: 0 } } }; }
  }
  return value;
}

function idFrom(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function toRecord(row: Row, attachments: AttachmentRow[]): QuoteLibraryRecord {
  return {
    id: String(row.id),
    user_id: row.user_id === null || row.user_id === undefined ? null : (typeof row.user_id === 'bigint' ? row.user_id.toString() : row.user_id),
    uploader_name: row.uploader_name ?? null,
    title: row.title,
    client_name: row.client_name ?? null,
    project_name: row.project_name ?? null,
    project_description: row.project_description,
    quote_data: normalizeQuoteData(row.quote_data),
    total_amount: Number(row.total_amount ?? 0),
    currency: row.currency ?? 'CNY',
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at,
    attachments: attachments.map((a) => ({
      id: String(a.id),
      category: a.category,
      original_name: a.original_name,
      stored_path: a.stored_path,
      url: toPublicUrl(a.stored_path),
      mime_type: a.mime_type ?? null,
      file_size: a.file_size ? Number(a.file_size) : null,
      uploaded_by: a.uploaded_by === null || a.uploaded_by === undefined
        ? null
        : (typeof a.uploaded_by === 'bigint' ? Number(a.uploaded_by) : a.uploaded_by),
      created_at: a.created_at,
    })),
  };
}

function inferCategory(file: File, fallback: QuoteLibraryAttachmentCategory | null): QuoteLibraryAttachmentCategory {
  if (fallback) return fallback;
  const mime = file.type || '';
  if (ALLOWED_MIME_FOR_PHOTO.has(mime)) return 'survey_photo';
  if (ALLOWED_MIME_FOR_OTHER.has(mime)) return 'other';
  const lower = file.name.toLowerCase();
  if (PHOTO_EXT.test(lower)) return 'survey_photo';
  if (OTHER_EXT.test(lower)) return 'other';
  return 'other';
}

async function loadRecord(database: ReturnType<typeof getDatabase>, id: number): Promise<{ row: Row; attachments: AttachmentRow[] } | null> {
  const record = await database.query<Row>(
    `SELECT library.id, library.user_id, users.name AS uploader_name, library.title, library.client_name,
            library.project_name, library.project_description, library.quote_data, library.total_amount,
            library.currency, library.is_published, library.created_at, library.updated_at
       FROM quote_library library
       LEFT JOIN users users ON users.id = library.user_id
      WHERE library.id = $1`,
    [id],
  );
  const row = record.rows[0];
  if (!row) return null;
  const attachments = await database.query<AttachmentRow>(
    `SELECT id, category, original_name, stored_path, mime_type, file_size, uploaded_by, created_at
       FROM quote_library_attachments WHERE library_id = $1 ORDER BY id`,
    [id],
  );
  return { row, attachments: attachments.rows };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const id = idFrom((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的资料库ID' }, { status: 400 });
    const data = await loadRecord(getDatabase(), id);
    if (!data) return NextResponse.json({ success: false, error: '报价资料不存在' }, { status: 404 });
    if (auth.session.role !== 'admin' && !data.row.is_published) {
      return NextResponse.json({ success: false, error: '该报价资料未发布' }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: toRecord(data.row, data.attachments) });
  } catch (error) {
    console.error('获取报价资料详情失败:', error);
    return NextResponse.json({ success: false, error: '获取报价资料详情失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const id = idFrom((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的资料库ID' }, { status: 400 });
    const database = getDatabase();
    const existing = await loadRecord(database, id);
    if (!existing) return NextResponse.json({ success: false, error: '报价资料不存在' }, { status: 404 });

    const form = await request.formData();

    let parsedQuote: QuoteData | undefined;
    const quoteDataRaw = asString(form.get('quote_data'));
    if (quoteDataRaw) {
      if (quoteDataRaw.length > MAX_QUOTE_DATA_BYTES) return NextResponse.json({ success: false, error: '报价单数据过大' }, { status: 400 });
      try { parsedQuote = JSON.parse(quoteDataRaw) as QuoteData; } catch { return NextResponse.json({ success: false, error: '报价单数据 JSON 解析失败' }, { status: 400 }); }
      if (!isObject(parsedQuote) || (parsedQuote as { template?: string }).template !== 'engineering-quote-v1') {
        return NextResponse.json({ success: false, error: '报价单模板版本不匹配' }, { status: 400 });
      }
    }

    const projectDescription = asString(form.get('project_description')) || existing.row.project_description;
    const clientName = form.has('client_name') ? (asString(form.get('client_name')) || null) : (existing.row.client_name ?? null);
    const projectName = form.has('project_name') ? (asString(form.get('project_name')) || null) : (existing.row.project_name ?? null);
    const explicitTitle = asString(form.get('title'));
    const title = explicitTitle || `${clientName ?? '报价资料'}${projectName ? '-' + projectName : ''}`;
    const isPublished = form.has('is_published') ? asBool(form.get('is_published'), Boolean(existing.row.is_published)) : Boolean(existing.row.is_published);
    const totalAmount = form.has('total_amount')
      ? asNumber(form.get('total_amount'))
      : (parsedQuote ? parsedQuote.summary.totals.taxable_total : Number(existing.row.total_amount));

    // 处理附件删除
    const removeIdsRaw = asString(form.get('remove_attachment_ids'));
    const removeIds = removeIdsRaw
      ? removeIdsRaw.split(',').map((s) => Number(s)).filter((n) => Number.isSafeInteger(n) && n > 0)
      : [];

    if (removeIds.length > 0) {
      const removed = await database.query<AttachmentRow>(
        `SELECT id, stored_path FROM quote_library_attachments WHERE library_id = $1 AND id = ANY($2::bigint[])`,
        [id, removeIds],
      );
      await database.query(
        `DELETE FROM quote_library_attachments WHERE library_id = $1 AND id = ANY($2::bigint[])`,
        [id, removeIds],
      );
      for (const r of removed.rows) {
        const abs = resolveSafeAbsolutePath(r.stored_path);
        if (abs) await safeUnlink(abs);
      }
    }

    // 处理新增附件
    const surveyPhotos = form.getAll('survey_photos').filter((f): f is File => f instanceof File && f.size > 0);
    const otherFiles = form.getAll('other_files').filter((f): f is File => f instanceof File && f.size > 0);
    const allFiles = [...surveyPhotos.map((f) => ({ file: f, fallback: 'survey_photo' as const })),
                      ...otherFiles.map((f) => ({ file: f, fallback: 'other' as const }))];

    const existingCount = await database.query<{ total: string | number }>(
      'SELECT COUNT(*)::text AS total FROM quote_library_attachments WHERE library_id = $1',
      [id],
    );
    const afterRemoval = Number(existingCount.rows[0]?.total ?? 0);
    if (afterRemoval + allFiles.length > MAX_ATTACHMENTS_PER_RECORD) {
      return NextResponse.json({ success: false, error: `附件总数不能超过 ${MAX_ATTACHMENTS_PER_RECORD} 个` }, { status: 400 });
    }

    const newAttachments: QuoteLibraryAttachment[] = [];
    for (const { file, fallback } of allFiles) {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        return NextResponse.json({ success: false, error: `附件 ${file.name} 超过 20MB 限制` }, { status: 400 });
      }
      const category = inferCategory(file, fallback);
      const mime = file.type || '';
      const allowSet = category === 'survey_photo' ? ALLOWED_MIME_FOR_PHOTO : ALLOWED_MIME_FOR_OTHER;
      const extOk = category === 'survey_photo' ? PHOTO_EXT.test(file.name.toLowerCase()) : OTHER_EXT.test(file.name.toLowerCase());
      if (!allowSet.has(mime) && !(mime === '' && extOk) && !(mime === 'application/octet-stream' && extOk)) {
        return NextResponse.json({ success: false, error: `附件 ${file.name} 类型不支持` }, { status: 400 });
      }

      const storedName = buildStoredName(file.name);
      const storedPath = buildStoredPath(id, category, storedName);
      const absDir = uploadsDir(String(id), category);
      const absFile = uploadsDir(String(id), category, storedName);
      await ensureDir(absDir);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(absFile, buffer);

      const result = await database.query<{ id: string | number | bigint; created_at: string }>(
        `INSERT INTO quote_library_attachments
           (library_id, category, original_name, stored_path, mime_type, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
        [id, category, file.name, storedPath, file.type || null, file.size, auth.session.userId ?? null],
      );
      const attachmentId = result.rows[0]?.id;
      const createdAt = result.rows[0]?.created_at;
      if (attachmentId !== undefined) {
        newAttachments.push({
          id: String(attachmentId),
          category,
          original_name: file.name,
          stored_path: storedPath,
          url: toPublicUrl(storedPath),
          mime_type: file.type || null,
          file_size: file.size,
          uploaded_by: auth.session.userId ?? null,
          created_at: createdAt ?? new Date().toISOString(),
        });
      }
    }

    // 更新主记录
    if (parsedQuote) {
      await database.query(
        `UPDATE quote_library SET
           title = $1, client_name = $2, project_name = $3, project_description = $4,
           quote_data = $5::jsonb, total_amount = $6, is_published = $7, updated_at = now()
         WHERE id = $8`,
        [title, clientName, projectName, projectDescription, JSON.stringify(parsedQuote), totalAmount.toFixed(2), isPublished, id],
      );
    } else {
      await database.query(
        `UPDATE quote_library SET
           title = $1, client_name = $2, project_name = $3, project_description = $4,
           total_amount = $5, is_published = $6, updated_at = now()
         WHERE id = $7`,
        [title, clientName, projectName, projectDescription, totalAmount.toFixed(2), isPublished, id],
      );
    }

    const refreshed = await loadRecord(database, id);
    if (!refreshed) return NextResponse.json({ success: false, error: '报价资料不存在' }, { status: 404 });
    return NextResponse.json({
      success: true,
      data: {
        ...toRecord(refreshed.row, refreshed.attachments),
        new_attachments: newAttachments,
      },
    });
  } catch (error) {
    console.error('更新报价资料失败:', error);
    return NextResponse.json({ success: false, error: '更新报价资料失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const id = idFrom((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的资料库ID' }, { status: 400 });
    const database = getDatabase();
    const existing = await loadRecord(database, id);
    if (!existing) return NextResponse.json({ success: false, error: '报价资料不存在' }, { status: 404 });

    await database.query('DELETE FROM quote_library_attachments WHERE library_id = $1', [id]);
    await database.query('DELETE FROM quote_library WHERE id = $1', [id]);

    // 删除物理文件：尝试移除整个 library_id 目录
    const dir = uploadsDir(String(id));
    try {
      const fs = await import('node:fs/promises');
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn('清理附件目录失败:', dir, error);
    }

    return NextResponse.json({ success: true, data: { id: String(id) } });
  } catch (error) {
    console.error('删除报价资料失败:', error);
    return NextResponse.json({ success: false, error: '删除报价资料失败' }, { status: 500 });
  }
}

// 防止 path 被未使用警告
void path;