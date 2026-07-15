import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';
import { getQuoteSummaries } from '@/lib/quote-summary';

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const createdBy = auth.session.role === 'admin' ? undefined : String(auth.session.userId ?? -1);
    const quotes = getQuoteSummaries(db, { source: 'engineering', createdBy });
    const amounts = quotes.map((quote) => quote.total);
    const totalAmount = amounts.reduce((sum, value) => sum + value, 0);

    const statusMap = new Map<string, { count: number; totalAmount: number }>();
    const monthMap = new Map<string, { count: number; totalAmount: number }>();
    const clientMap = new Map<string, { count: number; totalAmount: number }>();
    const rangeDefinitions = [
      { label: '0-1万', max: 10_000 }, { label: '1-5万', max: 50_000 },
      { label: '5-10万', max: 100_000 }, { label: '10-50万', max: 500_000 },
      { label: '50-100万', max: 1_000_000 }, { label: '100万以上', max: Number.POSITIVE_INFINITY },
    ];
    const rangeMap = new Map(rangeDefinitions.map((item) => [item.label, 0]));

    for (const quote of quotes) {
      const status = statusMap.get(quote.status) || { count: 0, totalAmount: 0 };
      status.count += 1;
      status.totalAmount += quote.total;
      statusMap.set(quote.status, status);

      const month = quote.createdAt.slice(0, 7);
      const monthly = monthMap.get(month) || { count: 0, totalAmount: 0 };
      monthly.count += 1;
      monthly.totalAmount += quote.total;
      monthMap.set(month, monthly);

      const client = quote.clientName || '未填写';
      const clientValue = clientMap.get(client) || { count: 0, totalAmount: 0 };
      clientValue.count += 1;
      clientValue.totalAmount += quote.total;
      clientMap.set(client, clientValue);

      const range = rangeDefinitions.find((item) => quote.total < item.max) ?? rangeDefinitions.at(-1)!;
      rangeMap.set(range.label, (rangeMap.get(range.label) || 0) + 1);
    }

    const now = new Date();
    const thisMonthKey = now.toISOString().slice(0, 7);
    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
    const thisMonth = monthMap.get(thisMonthKey) || { count: 0, totalAmount: 0 };
    const lastMonth = monthMap.get(previousMonth) || { count: 0, totalAmount: 0 };
    const percentChange = (current: number, previous: number) => previous === 0
      ? (current > 0 ? 100 : 0)
      : Math.round(((current - previous) / previous) * 10_000) / 100;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalCount: quotes.length,
          totalAmount,
          avgAmount: quotes.length ? totalAmount / quotes.length : 0,
          maxAmount: amounts.length ? Math.max(...amounts) : 0,
          minAmount: amounts.length ? Math.min(...amounts) : 0,
        },
        byStatus: [...statusMap].map(([status, value]) => ({ status, ...value })),
        byMonth: [...monthMap].sort(([a], [b]) => a.localeCompare(b)).slice(-12)
          .map(([month, value]) => ({ month, ...value })),
        byClient: [...clientMap].sort((a, b) => b[1].count - a[1].count).slice(0, 10)
          .map(([clientName, value]) => ({ clientName, ...value })),
        byAmountRange: [...rangeMap].map(([range, count]) => ({ range, count })),
        thisMonth: {
          ...thisMonth,
          countChange: percentChange(thisMonth.count, lastMonth.count),
          amountChange: percentChange(thisMonth.totalAmount, lastMonth.totalAmount),
        },
      },
    });
  } catch (error) {
    console.error('获取工程报价统计失败:', error);
    return NextResponse.json({ success: false, error: '获取工程报价统计失败' }, { status: 500 });
  }
}
