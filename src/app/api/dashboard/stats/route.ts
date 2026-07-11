import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';

// GET /api/dashboard/stats - 获取仪表盘统计数据
export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const timeRange = searchParams.get('time_range') || 'all'; // all, today, week, month, year

    // 构建时间过滤条件
    let timeCondition = '';
    const timeParams: any[] = [];
    
    if (timeRange !== 'all') {
      const now = new Date();
      let startDate: string;
      
      switch (timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1).toISOString();
          break;
        default:
          startDate = '';
      }
      
      if (startDate) {
        timeCondition = ' AND created_at >= ?';
        timeParams.push(startDate);
      }
    }

    // 构建用户过滤条件
    let userCondition = '';
    const userParams: any[] = [];
    if (userId && userId !== 'all') {
      userCondition = ' WHERE created_by = ?';
      userParams.push(userId);
    }

    // 1. 工程报价统计
    const [engResult] = await pool.execute(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(AVG(total), 0) as avg_amount,
        COALESCE(MAX(total), 0) as max_amount
      FROM engineering_quotes
      ${userCondition ? userCondition.replace('WHERE', 'AND') : ''}
      ${timeCondition}`,
      [...userParams, ...timeParams]
    );
    const engineeringStats = (engResult as any[])[0];

    // 2. 维保报价统计
    const [maintResult] = await pool.execute(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(AVG(total), 0) as avg_amount,
        COALESCE(MAX(total), 0) as max_amount
      FROM maintenance_quotes
      ${userCondition ? userCondition.replace('WHERE', 'AND') : ''}
      ${timeCondition}`,
      [...userParams, ...timeParams]
    );
    const maintenanceStats = (maintResult as any[])[0];

    // 3. 总体统计
    const totalCount = Number(engineeringStats.total_count) + Number(maintenanceStats.total_count);
    const totalAmount = Number(engineeringStats.total_amount) + Number(maintenanceStats.total_amount);
    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    // 4. 按用户统计（TOP 10）
    const userStats: any[] = [];
    
    // 从工程报价表获取用户统计
    const [engUserResult] = await pool.execute(
      `SELECT 
        COALESCE(created_by, 'unknown') as user_id,
        COALESCE(created_by_name, '未知用户') as user_name,
        COUNT(*) as eng_count,
        COALESCE(SUM(total), 0) as eng_amount
      FROM engineering_quotes
      ${timeCondition ? 'WHERE 1=1' + timeCondition : ''}
      GROUP BY created_by, created_by_name`,
      timeParams
    );
    
    // 从维保报价表获取用户统计
    const [maintUserResult] = await pool.execute(
      `SELECT 
        COALESCE(created_by, 'unknown') as user_id,
        COALESCE(created_by_name, '未知用户') as user_name,
        COUNT(*) as maint_count,
        COALESCE(SUM(total), 0) as maint_amount
      FROM maintenance_quotes
      ${timeCondition ? 'WHERE 1=1' + timeCondition : ''}
      GROUP BY created_by, created_by_name`,
      timeParams
    );

    // 合并用户统计
    const userMap = new Map();
    [...(engUserResult as any[]), ...(maintUserResult as any[])].forEach(row => {
      const key = row.user_id;
      if (!userMap.has(key)) {
        userMap.set(key, {
          userId: row.user_id,
          userName: row.user_name,
          engineeringCount: 0,
          engineeringAmount: 0,
          maintenanceCount: 0,
          maintenanceAmount: 0,
          totalCount: 0,
          totalAmount: 0
        });
      }
      const user = userMap.get(key);
      if (row.eng_count !== undefined) {
        user.engineeringCount = Number(row.eng_count);
        user.engineeringAmount = Number(row.eng_amount);
      }
      if (row.maint_count !== undefined) {
        user.maintenanceCount = Number(row.maint_count);
        user.maintenanceAmount = Number(row.maint_amount);
      }
      user.totalCount = user.engineeringCount + user.maintenanceCount;
      user.totalAmount = user.engineeringAmount + user.maintenanceAmount;
    });

    // 按总金额排序，取前10
    const topUsers = Array.from(userMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    // 5. 按月统计（近12个月）
    const monthlyStats: any[] = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyStats.push({
        month: monthKey,
        engineeringCount: 0,
        engineeringAmount: 0,
        maintenanceCount: 0,
        maintenanceAmount: 0,
        totalCount: 0,
        totalAmount: 0
      });
    }

    // 从工程报价表获取月度数据
    const [engMonthlyResult] = await pool.execute(
      `SELECT 
        substr(created_at, 1, 7) as month,
        COUNT(*) as count,
        COALESCE(SUM(total), 0) as amount
      FROM engineering_quotes
      WHERE created_at >= date('now', '-11 months', 'start of month')
      GROUP BY substr(created_at, 1, 7)
      ORDER BY month ASC`
    );
    
    // 从维保报价表获取月度数据
    const [maintMonthlyResult] = await pool.execute(
      `SELECT 
        substr(created_at, 1, 7) as month,
        COUNT(*) as count,
        COALESCE(SUM(total), 0) as amount
      FROM maintenance_quotes
      WHERE created_at >= date('now', '-11 months', 'start of month')
      GROUP BY substr(created_at, 1, 7)
      ORDER BY month ASC`
    );

    // 合并月度数据
    (engMonthlyResult as any[]).forEach(row => {
      const item = monthlyStats.find(m => m.month === row.month);
      if (item) {
        item.engineeringCount = Number(row.count);
        item.engineeringAmount = Number(row.amount);
        item.totalCount += item.engineeringCount;
        item.totalAmount += item.engineeringAmount;
      }
    });
    
    (maintMonthlyResult as any[]).forEach(row => {
      const item = monthlyStats.find(m => m.month === row.month);
      if (item) {
        item.maintenanceCount = Number(row.count);
        item.maintenanceAmount = Number(row.amount);
        item.totalCount += item.maintenanceCount;
        item.totalAmount += item.maintenanceAmount;
      }
    });

    // 6. 按状态统计
    const [engStatusResult] = await pool.execute(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as amount
       FROM engineering_quotes
       ${userCondition ? userCondition.replace('WHERE', 'AND').replace('AND', 'WHERE') : ''}
       GROUP BY status`,
      userParams
    );
    
    const [maintStatusResult] = await pool.execute(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as amount
       FROM maintenance_quotes
       ${userCondition ? userCondition.replace('WHERE', 'AND').replace('AND', 'WHERE') : ''}
       GROUP BY status`,
      userParams
    );

    const statusMap = new Map();
    [...(engStatusResult as any[]), ...(maintStatusResult as any[])].forEach(row => {
      const key = row.status || 'unknown';
      if (!statusMap.has(key)) {
        statusMap.set(key, { status: key, count: 0, amount: 0 });
      }
      const item = statusMap.get(key);
      item.count += Number(row.count);
      item.amount += Number(row.amount);
    });
    const byStatus = Array.from(statusMap.values());

    // 7. 最近的报价记录（混合工程和维保）
    const recentQuotes: any[] = [];
    
    const [recentEngResult] = await pool.execute(
      `SELECT 
        id, quote_number, project_name, client_name, total, status, 'engineering' as type,
        created_by, created_by_name, created_at
      FROM engineering_quotes
      ${userCondition}
      ORDER BY created_at DESC
      LIMIT 20`,
      userParams
    );
    
    const [recentMaintResult] = await pool.execute(
      `SELECT 
        id, quote_number, project_name, client_name, total, status, 'maintenance' as type,
        created_by, created_by_name, created_at
      FROM maintenance_quotes
      ${userCondition}
      ORDER BY created_at DESC
      LIMIT 20`,
      userParams
    );

    const allRecent = [...(recentEngResult as any[]), ...(recentMaintResult as any[])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalCount,
          totalAmount,
          avgAmount,
          engineeringCount: Number(engineeringStats.total_count),
          engineeringAmount: Number(engineeringStats.total_amount),
          maintenanceCount: Number(maintenanceStats.total_count),
          maintenanceAmount: Number(maintenanceStats.total_amount)
        },
        topUsers,
        monthlyStats,
        byStatus,
        recentQuotes: allRecent
      }
    });
  } catch (error) {
    console.error('获取仪表盘统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
