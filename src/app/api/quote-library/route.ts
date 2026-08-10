import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import {
  buildStoredName,
  buildStoredPath,
  ensureDir,
  toPublicUrl,
  uploadsDir,
  writeFile,
} from '@/lib/quote-library-storage';
import type {
  QuoteData,
  QuoteLibraryAttachment,
  QuoteLibraryAttachmentCategory,
  QuoteLibraryListResponse,
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

interface ListRow extends Record<string, unknown> {
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

function normalizeQuoteData(value: ListRow['quote_data']): QuoteData {
  if (typeof value === 'string') {
    try { return JSON.parse(value) as QuoteData; } catch { return { template: 'engineering-quote-v1', summary: { title: '', items: [], totals: { taxable_total: 0, tiejiang_taxable_total: 0, yidong_taxable_total: 0 } } }; }
  }
  return value;
}

function toRecord(row: ListRow, attachments?: QuoteLibraryAttachment[]): QuoteLibraryRecord {
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
    attachments,
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

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(params.get('page_size') || '20', 10) || 20));
    const keyword = asString(params.get('q'));
    const client = asString(params.get('client_name'));
    const includeUnpublished = auth.session.role === 'admin' && params.get('all') === 'true';

    const filters: string[] = [];
    const values: unknown[] = [];
    if (!includeUnpublished) {
      filters.push(`library.is_published = $${values.length + 1}`);
      values.push(true);
    }
    if (keyword) {
      filters.push(`(library.title ILIKE $${values.length + 1} OR library.client_name ILIKE $${values.length + 1} OR library.project_name ILIKE $${values.length + 1})`);
      values.push(`%${keyword}%`);
    }
    if (client) {
      filters.push(`library.client_name ILIKE $${values.length + 1}`);
      values.push(`%${client}%`);
    }
    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const database = getDatabase();
    const records = await database.query<ListRow>(
      `SELECT library.id, library.user_id, users.name AS uploader_name, library.title, library.client_name,
              library.project_name, library.project_description, library.quote_data, library.total_amount,
              library.currency, library.is_published, library.created_at, library.updated_at
         FROM quote_library library
         LEFT JOIN users users ON users.id = library.user_id
         ${where}
         ORDER BY library.created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, (page - 1) * pageSize],
    );
    const count = await database.query<{ total: string | number }>(
      `SELECT COUNT(*)::text AS total FROM quote_library library ${where}`,
      values,
    );

    const data: QuoteLibraryListResponse = {
      records: records.rows.map((r) => toRecord(r)),
      total: Number(count.rows[0]?.total ?? 0),
      page,
      page_size: pageSize,
    };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('获取报价资料库列表失败:', error);
    return NextResponse.json({ success: false, error: '获取报价资料库列表失败' }, { status: 500 });
  }
}

function validateQuoteData(value: unknown): { ok: true; data: QuoteData } | { ok: false; error: string } {
  if (!isObject(value)) return { ok: false, error: '报价单数据格式无效' };
  const template = (value as { template?: unknown }).template;
  if (template !== 'engineering-quote-v1') return { ok: false, error: '报价单模板版本不匹配' };
  const summary = (value as { summary?: unknown }).summary;
  if (!isObject(summary)) return { ok: false, error: '报价单 summary 字段缺失' };
  const items = (summary as { items?: unknown }).items;
  if (!Array.isArray(items)) return { ok: false, error: '报价单 items 字段缺失' };
  return { ok: true, data: value as unknown as QuoteData };
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const form = await request.formData();

    const projectDescription = asString(form.get('project_description'));
    if (!projectDescription) return NextResponse.json({ success: false, error: '项目简述不能为空' }, { status: 400 });

    const quoteDataRaw = asString(form.get('quote_data'));
    if (!quoteDataRaw) return NextResponse.json({ success: false, error: '报价单数据不能为空' }, { status: 400 });
    if (quoteDataRaw.length > MAX_QUOTE_DATA_BYTES) return NextResponse.json({ success: false, error: '报价单数据过大' }, { status: 400 });

    let parsedQuote: QuoteData;
    try {
      parsedQuote = JSON.parse(quoteDataRaw) as unknown as QuoteData;
    } catch {
      return NextResponse.json({ success: false, error: '报价单数据 JSON 解析失败' }, { status: 400 });
    }
    const validated = validateQuoteData(parsedQuote);
    if (!validated.ok) return NextResponse.json({ success: false, error: validated.error }, { status: 400 });

    const clientName = asString(form.get('client_name')) || null;
    const projectName = asString(form.get('project_name')) || null;
    const title = asString(form.get('title')) || `${clientName ?? '报价资料'}${projectName ? '-' + projectName : ''}`;
    const totalAmount = asNumber(form.get('total_amount'), validated.data.summary.totals.taxable_total);

    const surveyPhotos = form.getAll('survey_photos').filter((f): f is File => f instanceof File && f.size > 0);
    const otherFiles = form.getAll('other_files').filter((f): f is File => f instanceof File && f.size > 0);
    const allFiles = [...surveyPhotos.map((f) => ({ file: f, fallback: 'survey_photo' as const })),
                      ...otherFiles.map((f) => ({ file: f, fallback: 'other' as const }))];

    if (allFiles.length > MAX_ATTACHMENTS_PER_RECORD) {
      return NextResponse.json({ success: false, error: `附件数量不能超过 ${MAX_ATTACHMENTS_PER_RECORD} 个` }, { status: 400 });
    }
    for (const { file, fallback } of allFiles) {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        return NextResponse.json({ success: false, error: `附件 ${file.name} 超过 20MB 限制` }, { status: 400 });
      }
      const inferred = inferCategory(file, fallback);
      const mime = file.type || '';
      const allowSet = inferred === 'survey_photo' ? ALLOWED_MIME_FOR_PHOTO : ALLOWED_MIME_FOR_OTHER;
      const extOk = inferred === 'survey_photo' ? PHOTO_EXT.test(file.name.toLowerCase()) : OTHER_EXT.test(file.name.toLowerCase());
      if (!allowSet.has(mime) && !(mime === '' && extOk) && !(mime === 'application/octet-stream' && extOk)) {
        return NextResponse.json({ success: false, error: `附件 ${file.name} 类型不支持` }, { status: 400 });
      }
    }

    const database = getDatabase();
    const inserted = await database.query<{ id: string | number | bigint }>(
      `INSERT INTO quote_library
         (user_id, title, client_name, project_name, project_description, quote_data, total_amount, currency, is_published)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9) RETURNING id`,
      [
        auth.session.userId ?? null,
        title,
        clientName,
        projectName,
        projectDescription,
        JSON.stringify(validated.data),
        totalAmount.toFixed(2),
        asString(form.get('currency')) || 'CNY',
        asBool(form.get('is_published'), true),
      ],
    );
    const libraryId = inserted.rows[0]?.id;
    if (libraryId === undefined) throw new Error('报价资料库记录保存失败');
    const libraryIdString = String(libraryId);

    const attachmentRecords: QuoteLibraryAttachment[] = [];
    for (const { file, fallback } of allFiles) {
      const category = inferCategory(file, fallback);
      const storedName = buildStoredName(file.name);
      const storedPath = buildStoredPath(libraryIdString, category, storedName);
      const absDir = uploadsDir(libraryIdString, category);
      const absFile = uploadsDir(libraryIdString, category, storedName);
      await ensureDir(absDir);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(absFile, buffer);

      const result = await database.query<{ id: string | number | bigint; created_at: string }>(
        `INSERT INTO quote_library_attachments
           (library_id, category, original_name, stored_path, mime_type, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
        [
          libraryId,
          category,
          file.name,
          storedPath,
          file.type || null,
          file.size,
          auth.session.userId ?? null,
        ],
      );
      const attachmentId = result.rows[0]?.id;
      const createdAt = result.rows[0]?.created_at;
      if (attachmentId !== undefined) {
        attachmentRecords.push({
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

    return NextResponse.json({
      success: true,
      data: {
        id: String(libraryId),
        attachments: attachmentRecords,
        message: '报价资料库记录创建成功',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('创建报价资料库记录失败:', error);
    return NextResponse.json({ success: false, error: '创建报价资料库记录失败' }, { status: 500 });
  }
}