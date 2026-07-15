import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';
import { getQuoteSummaries, type QuoteSource } from '@/lib/quote-summary';

const SOURCES = new Set<QuoteSource>(['engineering', 'maintenance', 'quotation']);

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const searchParams = new URL(request.url).searchParams;
    const requestedType = searchParams.get('type');
    const source = requestedType && SOURCES.has(requestedType as QuoteSource)
      ? requestedType as QuoteSource
      : undefined;
    const createdBy = auth.session.role === 'admin'
      ? searchParams.get('user_id') || undefined
      : String(auth.session.userId ?? -1);
    const status = searchParams.get('status');
    const keyword = searchParams.get('keyword')?.trim().toLocaleLowerCase('zh-CN');
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get('page_size') || '20', 10) || 20),
    );

    const summaries = getQuoteSummaries(db, { source, createdBy })
      .filter((quote) => !status || quote.status === status)
      .filter((quote) => {
        if (!keyword) return true;
        return [quote.quoteNumber, quote.projectName, quote.clientName]
          .some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword));
      });
    const offset = (page - 1) * pageSize;
    const data = summaries.slice(offset, offset + pageSize).map((quote) => ({
      id: quote.identity,
      source_id: quote.id,
      quote_number: quote.quoteNumber,
      quote_type: quote.source,
      project_name: quote.projectName,
      client_name: quote.clientName,
      total: quote.total,
      total_amount: quote.total,
      status: quote.status,
      created_by: quote.createdBy,
      created_by_name: quote.createdByName,
      created_at: quote.createdAt,
      updated_at: quote.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data,
      total: summaries.length,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('获取报价列表失败:', error);
    return NextResponse.json({ success: false, error: '获取报价列表失败' }, { status: 500 });
  }
}
