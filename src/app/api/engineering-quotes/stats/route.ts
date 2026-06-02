import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';

// GET /api/engineering-quotes/stats - 获取报价统计数据
export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    // 1. 总体概览统计
    const [overviewResult] = await pool.execute(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(AVG(total), 0) as avg_amount,
        COALESCE(MAX(total), 0) as max_amount,
        COALESCE(MIN(total), 0) as min_amount
      FROM engineering_quotes`
    );
    const overview = (overviewResult as any[])[0];

    // 2. 按状态统计
    const [statusResult] = await pool.execute(
      `SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(total), 0) as total_amount
      FROM engineering_quotes
      GROUP BY status`
    );
    const byStatus = (statusResult as any[]).map(row => ({
      status: row.status,
      count: Number(row.count),
      totalAmount: Number(row.total_amount),
    }));

    // 3. 按月统计（近12个月）
    const [monthlyResult] = await pool.execute(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count,
        COALESCE(SUM(total), 0) as total_amount
      FROM engineering_quotes
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC`
    );
    const byMonth = (monthlyResult as any[]).map(row => ({
      month: row.month,
      count: Number(row.count),
      totalAmount: Number(row.total_amount),
    }));

    // 4. 客户报价频次 TOP10
    const [clientResult] = await pool.execute(
      `SELECT 
        COALESCE(client_name, '未填写') as client_name,
        COUNT(*) as count,
        COALESCE(SUM(total), 0) as total_amount
      FROM engineering_quotes
      GROUP BY client_name
      ORDER BY count DESC
      LIMIT 10`
    );
    const byClient = (clientResult as any[]).map(row => ({
      clientName: row.client_name,
      count: Number(row.count),
      totalAmount: Number(row.total_amount),
    }));

    // 5. 报价金额分布
    const [distributionResult] = await pool.execute(
      `SELECT 
        CASE 
          WHEN total < 10000 THEN '0-1万'
          WHEN total < 50000 THEN '1-5万'
          WHEN total < 100000 THEN '5-10万'
          WHEN total < 500000 THEN '10-50万'
          WHEN total < 1000000 THEN '50-100万'
          ELSE '100万以上'
        END as range_label,
        COUNT(*) as count
      FROM engineering_quotes
      GROUP BY range_label
      ORDER BY MIN(total) ASC`
    );
    const byAmountRange = (distributionResult as any[]).map(row => ({
      range: row.range_label,
      count: Number(row.count),
    }));

    // 6. 本月统计
    const [thisMonthResult] = await pool.execute(
      `SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total), 0) as total_amount
      FROM engineering_quotes
      WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`
    );
    const thisMonth = (thisMonthResult as any[])[0];

    // 7. 上月统计（用于环比计算）
    const [lastMonthResult] = await pool.execute(
      `SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total), 0) as total_amount
      FROM engineering_quotes
      WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')`
    );
    const lastMonth = (lastMonthResult as any[])[0];

    // 计算环比
    const thisMonthCount = Number(thisMonth.count);
    const lastMonthCount = Number(lastMonth.count);
    const thisMonthAmount = Number(thisMonth.total_amount);
    const lastMonthAmount = Number(lastMonth.total_amount);

    const countChange = lastMonthCount === 0
      ? (thisMonthCount > 0 ? 100 : 0)
      : Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 10000) / 100;

    const amountChange = lastMonthAmount === 0
      ? (thisMonthAmount > 0 ? 100 : 0)
      : Math.round(((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 10000) / 100;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalCount: Number(overview.total_count),
          totalAmount: Number(overview.total_amount),
          avgAmount: Number(overview.avg_amount),
          maxAmount: Number(overview.max_amount),
          minAmount: Number(overview.min_amount),
        },
        byStatus,
        byMonth,
        byClient,
        byAmountRange,
        thisMonth: {
          count: thisMonthCount,
          totalAmount: thisMonthAmount,
          countChange,
          amountChange,
        },
      },
    });
  } catch (error) {
    console.error('获取报价统计数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取报价统计数据失败' },
      { status: 500 }
    );
  }
}
