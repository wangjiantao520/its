import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { resolveSafeAbsolutePath } from '@/lib/quote-library-storage';

interface AttachmentRow extends Record<string, unknown> {
  id: string | number | bigint;
  library_id: string | number | bigint;
  category: string;
  original_name: string;
  stored_path: string;
  mime_type?: string | null;
  is_published?: boolean;
}

type RouteContext = { params: Promise<{ attachmentId: string }> };

function idFrom(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const attachmentId = idFrom((await params).attachmentId);
    if (!attachmentId) return NextResponse.json({ success: false, error: '无效的附件ID' }, { status: 400 });
    const database = getDatabase();
    const result = await database.query<AttachmentRow>(
      `SELECT attachment.id, attachment.library_id, attachment.category, attachment.original_name,
              attachment.stored_path, attachment.mime_type, library.is_published
         FROM quote_library_attachments attachment
         JOIN quote_library library ON library.id = attachment.library_id
        WHERE attachment.id = $1`,
      [attachmentId],
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ success: false, error: '附件不存在' }, { status: 404 });
    if (auth.session.role !== 'admin' && !row.is_published) {
      return NextResponse.json({ success: false, error: '附件所属资料未发布' }, { status: 403 });
    }
    const abs = resolveSafeAbsolutePath(row.stored_path);
    if (!abs || !fs.existsSync(abs)) {
      return NextResponse.json({ success: false, error: '文件已丢失' }, { status: 404 });
    }
    const buffer = fs.readFileSync(abs);
    const filename = row.original_name || 'attachment';
    const mime = row.mime_type || 'application/octet-stream';
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'content-type': mime,
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('读取附件失败:', error);
    return NextResponse.json({ success: false, error: '读取附件失败' }, { status: 500 });
  }
}