import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { getQuoteSummaries, quoteAmountToCents, quoteCentsToNumber, sumQuoteTotals } from '@/lib/quote-summary';

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const createdBy = auth.session.role === 'admin' ? undefined : String(auth.session.userId ?? -1);
    const quotes = await getQuoteSummaries(getDatabase(), { source: 'engineering', createdBy });
    const totalAmount = sumQuoteTotals(quotes);
    const grouped = <K extends string>(key: (quote: (typeof quotes)[number]) => K) => {
      const map = new Map<K, { count: number; cents: bigint }>();
      for (const quote of quotes) {
        const item = map.get(key(quote)) ?? { count: 0, cents: BigInt(0) };
        item.count += 1; item.cents += quoteAmountToCents(quote.total); map.set(key(quote), item);
      }
      return map;
    };
    const statusMap = grouped((quote) => quote.status);
    const monthMap = grouped((quote) => quote.createdAt.slice(0, 7));
    const clientMap = grouped((quote) => quote.clientName || '未填写');
    const ranges = [{ label: '0-1万', max: 10_000 }, { label: '1-5万', max: 50_000 }, { label: '5-10万', max: 100_000 }, { label: '10-50万', max: 500_000 }, { label: '50-100万', max: 1_000_000 }, { label: '100万以上', max: Number.POSITIVE_INFINITY }];
    const rangeMap = new Map(ranges.map((item) => [item.label, 0]));
    for (const quote of quotes) {
      const range = ranges.find((item) => quote.total < item.max) ?? ranges.at(-1)!;
      rangeMap.set(range.label, (rangeMap.get(range.label) ?? 0) + 1);
    }
    const now = new Date();
    const currentKey = now.toISOString().slice(0, 7);
    const previousKey = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
    const current = monthMap.get(currentKey) ?? { count: 0, cents: BigInt(0) };
    const previous = monthMap.get(previousKey) ?? { count: 0, cents: BigInt(0) };
    const percent = (currentValue: number, previousValue: number) => previousValue === 0 ? (currentValue > 0 ? 100 : 0) : Math.round(((currentValue - previousValue) / previousValue) * 10_000) / 100;
    const amounts = quotes.map((quote) => quote.total);
    return NextResponse.json({ success: true, data: {
      overview: { totalCount: quotes.length, totalAmount, avgAmount: quotes.length ? totalAmount / quotes.length : 0, maxAmount: amounts.length ? Math.max(...amounts) : 0, minAmount: amounts.length ? Math.min(...amounts) : 0 },
      byStatus: [...statusMap].map(([status, value]) => ({ status, count: value.count, totalAmount: quoteCentsToNumber(value.cents) })),
      byMonth: [...monthMap].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, value]) => ({ month, count: value.count, totalAmount: quoteCentsToNumber(value.cents) })),
      byClient: [...clientMap].sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([clientName, value]) => ({ clientName, count: value.count, totalAmount: quoteCentsToNumber(value.cents) })),
      byAmountRange: [...rangeMap].map(([range, count]) => ({ range, count })),
      thisMonth: { count: current.count, totalAmount: quoteCentsToNumber(current.cents), countChange: percent(current.count, previous.count), amountChange: percent(Number(current.cents), Number(previous.cents)) },
    } });
  } catch (error) {
    console.error('获取工程报价统计失败:', error);
    return NextResponse.json({ success: false, error: '获取工程报价统计失败' }, { status: 500 });
  }
}
