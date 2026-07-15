import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';
import { getQuoteSummaries } from '@/lib/quote-summary';

function rangeStart(range: string): Date | null {
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'week') return new Date(now.getTime() - 7 * 86_400_000);
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
}

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const searchParams = new URL(request.url).searchParams;
    const requestedUser = searchParams.get('user_id');
    const createdBy = auth.session.role === 'admin'
      ? requestedUser && requestedUser !== 'all' ? requestedUser : undefined
      : String(auth.session.userId ?? -1);
    const start = rangeStart(searchParams.get('time_range') || 'all');
    const quotes = getQuoteSummaries(db, { createdBy }).filter((quote) => {
      if (!start || !quote.createdAt) return true;
      return new Date(quote.createdAt).getTime() >= start.getTime();
    });

    const engineering = quotes.filter((quote) => quote.source === 'engineering');
    const maintenance = quotes.filter((quote) => quote.source !== 'engineering');
    const sum = (items: typeof quotes) => items.reduce((total, quote) => total + quote.total, 0);
    const totalAmount = sum(quotes);

    const userMap = new Map<string, {
      userId: string;
      userName: string;
      engineeringCount: number;
      engineeringAmount: number;
      maintenanceCount: number;
      maintenanceAmount: number;
      totalCount: number;
      totalAmount: number;
    }>();
    for (const quote of quotes) {
      const key = quote.createdBy || 'unknown';
      const item = userMap.get(key) || {
        userId: key,
        userName: quote.createdByName || '未知用户',
        engineeringCount: 0,
        engineeringAmount: 0,
        maintenanceCount: 0,
        maintenanceAmount: 0,
        totalCount: 0,
        totalAmount: 0,
      };
      if (quote.source === 'engineering') {
        item.engineeringCount += 1;
        item.engineeringAmount += quote.total;
      } else {
        item.maintenanceCount += 1;
        item.maintenanceAmount += quote.total;
      }
      item.totalCount += 1;
      item.totalAmount += quote.total;
      userMap.set(key, item);
    }

    const now = new Date();
    const monthlyStats = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthQuotes = quotes.filter((quote) => quote.createdAt.startsWith(month));
      const monthEngineering = monthQuotes.filter((quote) => quote.source === 'engineering');
      const monthMaintenance = monthQuotes.filter((quote) => quote.source !== 'engineering');
      return {
        month,
        engineeringCount: monthEngineering.length,
        engineeringAmount: sum(monthEngineering),
        maintenanceCount: monthMaintenance.length,
        maintenanceAmount: sum(monthMaintenance),
        totalCount: monthQuotes.length,
        totalAmount: sum(monthQuotes),
      };
    });

    const statusMap = new Map<string, { status: string; count: number; amount: number }>();
    for (const quote of quotes) {
      const item = statusMap.get(quote.status) || { status: quote.status, count: 0, amount: 0 };
      item.count += 1;
      item.amount += quote.total;
      statusMap.set(quote.status, item);
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalCount: quotes.length,
          totalAmount,
          avgAmount: quotes.length ? totalAmount / quotes.length : 0,
          engineeringCount: engineering.length,
          engineeringAmount: sum(engineering),
          maintenanceCount: maintenance.length,
          maintenanceAmount: sum(maintenance),
        },
        topUsers: [...userMap.values()].sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10),
        monthlyStats,
        byStatus: [...statusMap.values()],
        recentQuotes: quotes.slice(0, 20).map((quote) => ({
          id: quote.identity,
          quote_number: quote.quoteNumber,
          project_name: quote.projectName,
          client_name: quote.clientName,
          total: quote.total,
          status: quote.status,
          type: quote.source,
          created_by: quote.createdBy,
          created_by_name: quote.createdByName,
          created_at: quote.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('获取仪表盘统计失败:', error);
    return NextResponse.json({ success: false, error: '获取统计数据失败' }, { status: 500 });
  }
}
