import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';
import {
  deleteQuoteByIdentity,
  getQuoteSummaries,
  parseQuoteIdentity,
  updateQuoteDetails,
} from '@/lib/quote-summary';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = parseQuoteIdentity(id);
  if (!parsed) {
    return NextResponse.json({ success: false, error: '无效的报价标识' }, { status: 400 });
  }

  const createdBy = auth.session.role === 'admin' ? undefined : String(auth.session.userId ?? -1);
  const quote = getQuoteSummaries(db, { source: parsed.source, createdBy })
    .find((item) => item.id === parsed.id);
  if (!quote) {
    return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: quote });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!parseQuoteIdentity(id)) {
    return NextResponse.json({ success: false, error: '无效的报价标识' }, { status: 400 });
  }
  if (!deleteQuoteByIdentity(db, id)) {
    return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { message: '删除成功' } });
}

const updateSchema = z.object({
  projectName: z.string().trim().min(1, '项目名称不能为空').max(200),
  clientName: z.string().trim().min(1, '客户名称不能为空').max(200),
  total: z.coerce.number().finite().min(0, '报价金额不能小于0'),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = parseQuoteIdentity(id);
  if (!parsed) {
    return NextResponse.json({ success: false, error: '无效的报价标识' }, { status: 400 });
  }
  const createdBy = auth.session.role === 'admin' ? undefined : String(auth.session.userId ?? -1);
  const quote = getQuoteSummaries(db, { source: parsed.source, createdBy })
    .find((item) => item.id === parsed.id);
  if (!quote) {
    return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
  }

  const parsedBody = updateSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: parsedBody.error.issues[0]?.message || '请求参数无效' },
      { status: 400 },
    );
  }
  updateQuoteDetails(db, id, parsedBody.data);
  return NextResponse.json({ success: true, data: { id } });
}
