import { createClient } from '@supabase/supabase-js';

import {
  MAX_ATTACHMENT_SIZE_BYTES,
  OTHER_FILE_MIME,
  SURVEY_PHOTO_MIME,
} from './quote-library-types';
import type { QuoteLibraryStagedUpload } from './quote-library-types';

const STAGING_PREFIX = 'staging/';
export const QUOTE_LIBRARY_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'quote-library';

type StorageClient = ReturnType<typeof createClient>;
type StorageGlobal = typeof globalThis & {
  __itsSupabaseStorageClient__?: StorageClient;
};

function getStorageClient(): StorageClient {
  const globalStorage = globalThis as StorageGlobal;
  if (!globalStorage.__itsSupabaseStorageClient__) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase Storage server credentials are not configured.');
    }
    globalStorage.__itsSupabaseStorageClient__ = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
  return globalStorage.__itsSupabaseStorageClient__;
}

export function getQuoteLibraryStorageBucket() {
  return getStorageClient().storage.from(QUOTE_LIBRARY_BUCKET);
}

export function isSupabaseQuoteLibraryPath(value: string): boolean {
  const parts = value.split('/');
  return parts.length === 3 &&
    parts[0] === STAGING_PREFIX.slice(0, -1) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[1] ?? '') &&
    Boolean(parts[2]) &&
    parts[2] !== '.' &&
    parts[2] !== '..' &&
    !/[\\\u0000-\u001f]/.test(parts[2] ?? '');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseStagedQuoteLibraryUploads(
  raw: FormDataEntryValue | null,
): { ok: true; uploads: QuoteLibraryStagedUpload[] } | { ok: false; error: string } {
  if (raw === null || raw === '') return { ok: true, uploads: [] };
  if (typeof raw !== 'string') return { ok: false, error: '附件上传信息格式无效' };

  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: '附件上传信息解析失败' };
  }
  if (!Array.isArray(value)) return { ok: false, error: '附件上传信息格式无效' };

  const uploads: QuoteLibraryStagedUpload[] = [];
  const paths = new Set<string>();
  for (const item of value) {
    if (!isObject(item)) return { ok: false, error: '附件上传信息格式无效' };
    const path = typeof item.path === 'string' ? item.path : '';
    const originalName = typeof item.original_name === 'string' ? item.original_name.trim() : '';
    const fileSize = item.file_size;
    const mimeType = item.mime_type === null || item.mime_type === undefined
      ? ''
      : (typeof item.mime_type === 'string' ? item.mime_type : null);
    const category = item.category;
    const extensionMatches = category === 'survey_photo'
      ? /\.(jpe?g|png|webp|heic|heif)$/i.test(originalName)
      : /\.(pdf|docx?|xlsx?|pptx?|zip|dwg|dxf|svg)$/i.test(originalName);
    const allowedMime = category === 'survey_photo' ? SURVEY_PHOTO_MIME : OTHER_FILE_MIME;
    if (
      !isSupabaseQuoteLibraryPath(path) ||
      paths.has(path) ||
      !originalName ||
      originalName.length > 255 ||
      typeof fileSize !== 'number' ||
      !Number.isSafeInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_ATTACHMENT_SIZE_BYTES ||
      (category !== 'survey_photo' && category !== 'other') ||
      mimeType === null ||
      (!allowedMime.includes(mimeType) &&
        !(mimeType === '' && extensionMatches) &&
        !(mimeType === 'application/octet-stream' && extensionMatches))
    ) {
      return { ok: false, error: '附件上传信息无效' };
    }
    paths.add(path);
    uploads.push({
      path,
      original_name: originalName,
      file_size: fileSize,
      mime_type: mimeType || null,
      category,
    });
  }
  return { ok: true, uploads };
}

export async function createQuoteLibrarySignedUpload(path: string): Promise<string> {
  const { data, error } = await getQuoteLibraryStorageBucket().createSignedUploadUrl(path, { upsert: false });
  if (error) throw error;
  if (!data.token) throw new Error('Supabase did not return an upload token.');
  return data.token;
}

export async function verifyQuoteLibraryObject(path: string, expectedSize: number): Promise<void> {
  const { data, error } = await getQuoteLibraryStorageBucket().info(path);
  if (error) throw error;
  if (Number(data.size) !== expectedSize) {
    throw new Error('Uploaded attachment size does not match the submitted metadata.');
  }
}

export async function createQuoteLibrarySignedDownload(path: string, filename: string): Promise<string> {
  const { data, error } = await getQuoteLibraryStorageBucket().createSignedUrl(path, 60, { download: filename });
  if (error) throw error;
  if (!data.signedUrl) throw new Error('Supabase did not return a download URL.');
  return data.signedUrl;
}

export async function removeQuoteLibraryObjects(paths: string[]): Promise<void> {
  const safePaths = paths.filter(isSupabaseQuoteLibraryPath);
  if (safePaths.length === 0) return;
  const { error } = await getQuoteLibraryStorageBucket().remove(safePaths);
  if (error) throw error;
}
