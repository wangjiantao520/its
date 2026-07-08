import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';
import { verifySession } from '@/lib/auth';

// GET /api/dashboard — 获取数据看板统计数据
export async function GET(request: NextRequest) {
  const session = verifySession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    await initDatabase();

    // 1. 统计卡片数据
    // 报价总数（维保 + 工程）
    const [maintTotal] = await pool.query(
      'SELECT COUNT(*) as count FROM maintenance_quotes'
    ) as [any[], any];
    const [engTotal] = await pool.query(
      'SELECT COUNT(*) as count FROM engineering_quotes'
    ) as [any[], any];
    const totalQuotes = (maintTotal[0]?.count || 0) + (engTotal[0]?.count || 0);

    // 本月新增（维保 + 工程）
    const [maintThisMonth] = await pool.query(
      `SELECT COUNT(*) as count FROM maintenance_quotes
       WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`
    ) as [any[], any];
    const [engThisMonth] = await pool.query(
      `SELECT COUNT(*) as count FROM engineering_quotes
       WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`
    ) as [any[], any];
    const thisMonth = (maintThisMonth[0]?.count || 0) + (engThisMonth[0]?.count || 0);

    // 上月新增（用于环比计算）
    const [maintLastMonth] = await pool.query(
      `SELECT COUNT(*) as count FROM maintenance_quotes
       WHERE YEAR(created_at) = YEAR(CURDATE() - INTERVAL 1 MONTH)
         AND MONTH(created_at) = MONTH(CURDATE() - INTERVAL 1 MONTH)`
    ) as [any[], any];
    const [engLastMonth] = await pool.query(
      `SELECT COUNT(*) as count FROM engineering_quotes
       WHERE YEAR(created_at) = YEAR(CURDATE() - INTERVAL 1 MONTH)
         AND MONTH(created_at) = MONTH(CURDATE() - INTERVAL 1 MONTH)`
    ) as [any[], any];
    const lastMonth = (maintLastMonth[0]?.count || 0) + (engLastMonth[0]?.count || 0);

    // 待审核
    const [maintPending] = await pool.query(
      `SELECT COUNT(*) as count FROM maintenance_quotes WHERE status = 'pending_review'`
    ) as [any[], any];
    const [engPending] = await pool.query(
      `SELECT COUNT(*) as count FROM engineering_quotes WHERE status = 'pending_review'`
    ) as [any[], any];
    const pendingReview = (maintPending[0]?.count || 0) + (engPending[0]?.count || 0);

    // 即将到期：维保报价中 service_years 对应的合同到期时间
    // 用 created_at + service_years 年 计算到期日，筛选未来30天内到期的
    const [expiringRows] = await pool.query(
      `SELECT id, quote_number, project_name, client_name, service_years, created_at,
              DATEDIFF(DATE_ADD(created_at, INTERVAL service_years YEAR), CURDATE()) as days_left
       FROM maintenance_quotes
       WHERE status IN ('approved', 'sent')
         AND DATEDIFF(DATE_ADD(created_at, INTERVAL service_years YEAR), CURDATE()) BETWEEN 0 AND 30
       ORDER BY days_left ASC
       LIMIT 10`
    ) as [any[], any];

    const expiringSoon = expiringRows.length;

    // 环比增长描述
    const monthDiff = thisMonth - lastMonth;
    const monthGrowthPercent = lastMonth > 0
      ? Math.round((monthDiff / lastMonth) * 100)
      : (thisMonth > 0 ? 100 : 0);

    // 2. 月度趋势（近6个月）
    const [monthlyData] = await pool.query(
      `SELECT
         DATE_FORMAT(m.month, '%c月') as month,
         COALESCE(m.cnt, 0) + COALESCE(e.cnt, 0) as quotes
       FROM (
         SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n MONTH), '%Y-%m-01') as month
         FROM (SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) nums
       ) m
       LEFT JOIN (
         SELECT DATE_FORMAT(created_at, '%Y-%m-01') as month, COUNT(*) as cnt
         FROM maintenance_quotes
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(created_at, '%Y-%m-01')
       ) m2 ON m.month = m2.month
       LEFT JOIN (
         SELECT DATE_FORMAT(created_at, '%Y-%m-01') as month, COUNT(*) as cnt
         FROM engineering_quotes
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(created_at, '%Y-%m-01')
       ) e ON m.month = e.month
       ORDER BY m.month ASC`
    ) as [any[], any];

    // 3. 最近操作（从审计日志获取）
    const [recentLogs] = await pool.query(
      `SELECT
         al.id, al.quote_id, al.quote_type, al.action, al.from_status, al.to_status,
         al.comment, al.operator, al.created_at,
         COALESCE(mq.quote_number, eq.quote_number) as quote_number,
         COALESCE(mq.project_name, eq.project_name) as project_name,
         COALESCE(mq.client_name, eq.client_name) as client_name
       FROM quote_audit_logs al
       LEFT JOIN maintenance_quotes mq ON al.quote_id = mq.id AND al.quote_type = 'maintenance'
       LEFT JOIN engineering_quotes eq ON al.quote_id = eq.id AND al.quote_type = 'engineering'
       ORDER BY al.created_at DESC
       LIMIT 10`
    ) as [any[], any];

    // 4. 各状态分布（用于后续扩展）
    const [maintStatusDist] = await pool.query(
      `SELECT status, COUNT(*) as count FROM maintenance_quotes GROUP BY status`
    ) as [any[], any];
    const [engStatusDist] = await pool.query(
      `SELECT status, COUNT(*) as count FROM engineering_quotes GROUP BY status`
    ) as [any[], any];

    // 合并状态分布
    const statusDistribution: Record<string, number> = {};
    for (const row of [...maintStatusDist, ...engStatusDist] as any[]) {
      statusDistribution[row.status] = (statusDistribution[row.status] || 0) + row.count;
    }

    // 客户总数
    const [clientTotal] = await pool.query(
      'SELECT COUNT(*) as count FROM clients'
    ) as [any[], any];
    const totalClients = clientTotal[0]?.count || 0;

    // 设备定额总数
    const [deviceTotal] = await pool.query(
      'SELECT COUNT(*) as count FROM device_quotas'
    ) as [any[], any];
    const totalDevices = deviceTotal[0]?.count || 0;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalQuotes,
          thisMonth,
          lastMonth,
          monthDiff,
          monthGrowthPercent,
          pendingReview,
          expiringSoon,
          totalClients,
          totalDevices,
        },
        monthlyTrends: monthlyData,
        recentActivity: recentLogs.map((log: any) => ({
          id: log.id,
          quoteId: log.quote_id,
          quoteType: log.quote_type,
          action: log.action,
          fromStatus: log.from_status,
          toStatus: log.to_status,
          comment: log.comment,
          operator: log.operator,
          createdAt: log.created_at,
          quoteNumber: log.quote_number,
          projectName: log.project_name,
          clientName: log.client_name,
        })),
        expiringItems: expiringRows.map((row: any) => ({
          id: row.id,
          quoteNumber: row.quote_number,
          projectName: row.project_name,
          clientName: row.client_name,
          serviceYears: row.service_years,
          createdAt: row.created_at,
          daysLeft: row.days_left,
        })),
        statusDistribution,
      },
    });
  } catch (error) {
    console.error('获取看板数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取看板数据失败' },
      { status: 500 }
    );
  }
}
