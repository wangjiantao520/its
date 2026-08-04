import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { getQuoteSummaries, quoteAmountToCents, quoteCentsToNumber, sumQuoteTotals, type QuoteSummary } from '@/lib/quote-summary';

function rangeStart(range: string): Date | null {
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'week') return new Date(now.getTime() - 7 * 86_400_000);
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
}
function sum(items: readonly QuoteSummary[]): number { return sumQuoteTotals(items); }

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const requested = request.nextUrl.searchParams.get('user_id');
    const createdBy = auth.session.role === 'admin' ? requested && requested !== 'all' ? requested : undefined : String(auth.session.userId ?? -1);
    const start = rangeStart(request.nextUrl.searchParams.get('time_range') || 'all');
    const quotes = (await getQuoteSummaries(getDatabase(), { createdBy })).filter((quote) => !start || !quote.createdAt || new Date(quote.createdAt).getTime() >= start.getTime());
    const engineering = quotes.filter((quote) => quote.source === 'engineering');
    const maintenance = quotes.filter((quote) => quote.source !== 'engineering');
    const totalAmount = sum(quotes);
    const users = new Map<string, { userId: string; userName: string; engineeringCount: number; engineeringCents: bigint; maintenanceCount: number; maintenanceCents: bigint; totalCount: number; totalCents: bigint }>();
    for (const quote of quotes) {
      const key = quote.createdBy || 'unknown'; const cents = quoteAmountToCents(quote.total);
      const item = users.get(key) ?? { userId: key, userName: quote.createdByName || '未知用户', engineeringCount: 0, engineeringCents: BigInt(0), maintenanceCount: 0, maintenanceCents: BigInt(0), totalCount: 0, totalCents: BigInt(0) };
      if (quote.source === 'engineering') { item.engineeringCount += 1; item.engineeringCents += cents; } else { item.maintenanceCount += 1; item.maintenanceCents += cents; }
      item.totalCount += 1; item.totalCents += cents; users.set(key, item);
    }
    const topUsers = [...users.values()].sort((a, b) => a.totalCents === b.totalCents ? 0 : a.totalCents > b.totalCents ? -1 : 1).slice(0, 10).map((item) => ({
      userId: item.userId, userName: item.userName, engineeringCount: item.engineeringCount, engineeringAmount: quoteCentsToNumber(item.engineeringCents), maintenanceCount: item.maintenanceCount, maintenanceAmount: quoteCentsToNumber(item.maintenanceCents), totalCount: item.totalCount, totalAmount: quoteCentsToNumber(item.totalCents),
    }));
    const now = new Date();
    const monthlyStats = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1); const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthQuotes = quotes.filter((quote) => quote.createdAt.startsWith(month)); const monthEngineering = monthQuotes.filter((quote) => quote.source === 'engineering'); const monthMaintenance = monthQuotes.filter((quote) => quote.source !== 'engineering');
      return { month, engineeringCount: monthEngineering.length, engineeringAmount: sum(monthEngineering), maintenanceCount: monthMaintenance.length, maintenanceAmount: sum(monthMaintenance), totalCount: monthQuotes.length, totalAmount: sum(monthQuotes) };
    });
    const statuses = new Map<string, { count: number; cents: bigint }>();
    for (const quote of quotes) { const item = statuses.get(quote.status) ?? { count: 0, cents: BigInt(0) }; item.count += 1; item.cents += quoteAmountToCents(quote.total); statuses.set(quote.status, item); }
    return NextResponse.json({ success: true, data: {
      overview: { totalCount: quotes.length, totalAmount, avgAmount: quotes.length ? totalAmount / quotes.length : 0, engineeringCount: engineering.length, engineeringAmount: sum(engineering), maintenanceCount: maintenance.length, maintenanceAmount: sum(maintenance) },
      topUsers, monthlyStats, byStatus: [...statuses].map(([status, item]) => ({ status, count: item.count, amount: quoteCentsToNumber(item.cents) })),
      recentQuotes: quotes.slice(0, 20).map((quote) => ({ id: quote.identity, quote_number: quote.quoteNumber, project_name: quote.projectName, client_name: quote.clientName, total: quote.total, status: quote.status, type: quote.source, created_by: quote.createdBy, created_by_name: quote.createdByName, created_at: quote.createdAt })),
    } });
  } catch (error) {
    console.error('获取仪表盘统计失败:', error);
    return NextResponse.json({ success: false, error: '获取统计数据失败' }, { status: 500 });
  }
}
