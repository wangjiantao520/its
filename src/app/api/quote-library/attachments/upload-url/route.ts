import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { buildStoredName } from '@/lib/quote-library-storage';
import { MAX_ATTACHMENT_SIZE_BYTES, OTHER_FILE_MIME, SURVEY_PHOTO_MIME } from '@/lib/quote-library-types';
import {
  createQuoteLibrarySignedUpload,
  isSupabaseQuoteLibraryPath,
  QUOTE_LIBRARY_BUCKET,
  removeQuoteLibraryObjects,
} from '@/lib/supabase-storage';
import type { QuoteLibraryAttachmentCategory } from '@/lib/quote-library-types';

export const runtime = 'nodejs';

const PHOTO_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const OTHER_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|dwg|dxf|svg)$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidUpload(
  category: QuoteLibraryAttachmentCategory,
  filename: string,
  mimeType: string,
): boolean {
  const allowedMime = category === 'survey_photo' ? SURVEY_PHOTO_MIME : OTHER_FILE_MIME;
  const extensionMatches = category === 'survey_photo'
    ? PHOTO_EXT.test(filename)
    : OTHER_EXT.test(filename);
  return allowedMime.includes(mimeType) ||
    ((mimeType === '' || mimeType === 'application/octet-stream') && extensionMatches);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const body: unknown = await request.json();
    if (!isObject(body)) {
      return NextResponse.json({ success: false, error: '附件信息格式无效' }, { status: 400 });
    }
    const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
    const mimeType = typeof body.mime_type === 'string' ? body.mime_type : '';
    const size = body.file_size;
    const category = body.category;
    if (
      !filename || filename.length > 255 ||
      typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0 || size > MAX_ATTACHMENT_SIZE_BYTES ||
      (category !== 'survey_photo' && category !== 'other') ||
      !isValidUpload(category, filename, mimeType)
    ) {
      return NextResponse.json({ success: false, error: '附件类型或大小不符合要求' }, { status: 400 });
    }

    const path = `staging/${randomUUID()}/${buildStoredName(filename)}`;
    const token = await createQuoteLibrarySignedUpload(path);
    return NextResponse.json({ success: true, data: { path, token, bucket: QUOTE_LIBRARY_BUCKET } });
  } catch (error) {
    console.error('创建附件上传授权失败:', error);
    return NextResponse.json({ success: false, error: '附件上传服务暂不可用，请检查 Supabase Storage 配置' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const body: unknown = await request.json();
    if (!isObject(body) || !Array.isArray(body.paths) || body.paths.length > 30) {
      return NextResponse.json({ success: false, error: '附件路径格式无效' }, { status: 400 });
    }
    const paths = body.paths.filter((path): path is string => typeof path === 'string');
    if (paths.length !== body.paths.length || paths.some((path) => !isSupabaseQuoteLibraryPath(path))) {
      return NextResponse.json({ success: false, error: '附件路径无效' }, { status: 400 });
    }
    await removeQuoteLibraryObjects(paths);
    return NextResponse.json({ success: true, data: { removed: paths.length } });
  } catch (error) {
    console.error('清理未关联附件失败:', error);
    return NextResponse.json({ success: false, error: '清理未关联附件失败' }, { status: 500 });
  }
}
