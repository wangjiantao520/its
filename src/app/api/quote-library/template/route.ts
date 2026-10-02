import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { createQuoteLibraryTemplateBuffer } from '@/lib/quote-library-server-export';

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const filename = '工程报价导入模板.xlsx';
  const buffer = createQuoteLibraryTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  });
}
