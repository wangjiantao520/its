import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { parseWorkbookBufferToQuoteData } from '@/lib/quote-library-server-export';

const MAX_BYTES = 10 * 1024 * 1024;
const EXT_OK = /\.(xlsx|xls)$/i;

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: '请选择文件' }, { status: 400 });
    if (!EXT_OK.test(file.name)) return NextResponse.json({ success: false, error: '仅支持 .xlsx / .xls 文件' }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ success: false, error: '上传文件为空' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ success: false, error: '文件超过 10MB' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const data = parseWorkbookBufferToQuoteData(arrayBuffer);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '解析失败';
    return NextResponse.json({ success: false, error: `文件解析失败：${message}` }, { status: 400 });
  }
}