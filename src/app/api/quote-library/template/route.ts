import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

import { requireApiAuth } from '@/lib/api-auth-server';

function findTemplatePath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '康海物流固话线路整改报价V2.xlsx'),
    path.resolve(process.cwd(), 'src/lib/quote-library/template.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const target = findTemplatePath();
  if (!target) {
    return NextResponse.json({ success: false, error: '模板文件不存在' }, { status: 404 });
  }
  const buffer = fs.readFileSync(target);
  const filename = path.basename(target);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  });
}