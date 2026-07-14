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
      userCondition = ' AND user_id = ?';
      userParams.push(userId);
    }

    const baseWhere = `WHERE 1=1 ${userCondition} ${timeCondition}`;
    const baseParams = [...userParams, ...timeParams];

    // 1. 工程报价统计（从 quotation_records 的 quote_type 区分，但目前成员端保存到这里）
    //    为了统一统计，把 quotation_records 作为统计主表
    //    工程报价和维保报价通过 quote_type 或业务表关联区分
    //    简化处理：用两张业务表 + quotation_records 三张表合并统计
    //    但为避免重复，优先统计 quotation_records（成员端数据），
    //    再加上业务表中不在 quotation_records 中的部分（管理端数据）
    
    // 先从 quotation_records 获取总体和按类型统计
    const [totalResult] = await pool.execute(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(AVG(total_amount), 0) as avg_amount
      FROM quotation_records
      ${baseWhere}`,
      baseParams
    );
    const totalStats = (totalResult as any[])[0];

    // 从工程报价表统计（管理端工程报价）
    const [engResult] = await pool.execute(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(total), 0) as total_amount
      FROM engineering_quotes
      WHERE 1=1 ${userCondition.replace('user_id', 'created_by')} ${timeCondition}`,
      [...userParams, ...timeParams]
    );
    const engineeringStats = (engResult as any[])[0];

    // 从维保报价表统计（管理端维保报价）
    const [maintResult] = await pool.execute(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(total), 0) as total_amount
      FROM maintenance_quotes
      WHERE 1=1 ${userCondition.replace('user_id', 'created_by')} ${timeCondition}`,
      [...userParams, ...timeParams]
    );
    const maintenanceStats = (maintResult as any[])[0];

    // 工程和维保的划分：从 quotation_records 中按设备类型/字段推断比较困难
    // 简化：将 quotation_records 视为成员端报价（计入工程或维保的总数）
    // 业务表(engineering_quotes, maintenance_quotes)视为管理端报价
    // 总数 = 业务表总数 + quotation_records 总数 （避免重复，我们这里假设两者不重叠）
    
    // 更稳妥的方案：把 quotation_records 中的数据按 quote_data 里的内容区分工程/维保
    // 但 quote_data 是 JSON，SQLite 解析麻烦
    // 折中方案：总数 = quotation_records 总数 + 业务表中未被 quotation_records 包含的
    // 但由于 quotation_records 和业务表结构完全不同，无法去重
    
    // 最合理方案：quotation_records 是统一存储，业务表是各自的详细存储
    // 数据看板应该以 quotation_records 为主表，因为它是成员端和管理端共用的
    
    // 让我们重新设计：统计全部从 quotation_records 读取
    // 工程/维保分类通过 quote_data 或增加一个 type 字段来区分
    // 目前先：所有 quotation_records 都算作"维保报价"（因为维保成员端用的是这个接口）
    // 管理端的 engineering_quotes / maintenance_quotes 也加进来
    
    // 实际：成员端保存到 /api/quotations -> quotation_records
    // 管理端工程保存到 /api/engineering-quotes -> engineering_quotes  
    // 管理端维保保存到 /api/maintenance-quotes -> maintenance_quotes
    
    // 为了看板完整显示，把三张表的数据合并统计
    // 工程报价 = engineering_quotes
    // 维保报价 = maintenance_quotes + quotation_records（成员端的维保报价）
    // 这个方案最符合当前数据结构
    
    const engineeringCount = Number(engineeringStats.total_count);
    const engineeringAmount = Number(engineeringStats.total_amount);
    
    const memberMaintCount = Number(totalStats.total_count);
    const memberMaintAmount = Number(totalStats.total_amount);
    const adminMaintCount = Number(maintenanceStats.total_count);
    const adminMaintAmount = Number(maintenanceStats.total_amount);
    const maintenanceCount = memberMaintCount + adminMaintCount;
    const maintenanceAmount = memberMaintAmount + adminMaintAmount;
    
    const totalCount = engineeringCount + maintenanceCount;
    const totalAmount = engineeringAmount + maintenanceAmount;
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

    // 从 quotation_records 获取成员端用户统计（这些都是维保报价）
    const [recordsUserResult] = await pool.execute(
      `SELECT 
        COALESCE(user_id, 'unknown') as user_id,
        COALESCE(u.name, u.username, '未知用户') as user_name,
        COUNT(*) as records_count,
        COALESCE(SUM(total_amount), 0) as records_amount
      FROM quotation_records q
      LEFT JOIN users u ON q.user_id = u.id
      ${timeCondition ? 'WHERE 1=1' + timeCondition : ''}
      GROUP BY user_id, u.name, u.username`,
      timeParams
    );
    
    // 合并用户统计
    const userMap = new Map();
    
    [...(engUserResult as any[])].forEach(row => {
      const key = String(row.user_id);
      if (!userMap.has(key)) {
        userMap.set(key, {
          userId: key,
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
      user.engineeringCount += Number(row.eng_count);
      user.engineeringAmount += Number(row.eng_amount);
      user.totalCount += Number(row.eng_count);
      user.totalAmount += Number(row.eng_amount);
    });
    
    [...(maintUserResult as any[])].forEach(row => {
      const key = String(row.user_id);
      if (!userMap.has(key)) {
        userMap.set(key, {
          userId: key,
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
      user.maintenanceCount += Number(row.maint_count);
      user.maintenanceAmount += Number(row.maint_amount);
      user.totalCount += Number(row.maint_count);
      user.totalAmount += Number(row.maint_amount);
    });

    // 成员端报价（计入维保）
    [...(recordsUserResult as any[])].forEach(row => {
      const key = String(row.user_id);
      if (!userMap.has(key)) {
        userMap.set(key, {
          userId: key,
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
      user.maintenanceCount += Number(row.records_count);
      user.maintenanceAmount += Number(row.records_amount);
      user.totalCount += Number(row.records_count);
      user.totalAmount += Number(row.records_amount);
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

    // 从 quotation_records 获取月度数据（成员端维保）
    const [recordsMonthlyResult] = await pool.execute(
      `SELECT 
        substr(created_at, 1, 7) as month,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as amount
      FROM quotation_records
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
        item.maintenanceCount += Number(row.count);
        item.maintenanceAmount += Number(row.amount);
        item.totalCount += Number(row.count);
        item.totalAmount += Number(row.amount);
      }
    });

    (recordsMonthlyResult as any[]).forEach(row => {
      const item = monthlyStats.find(m => m.month === row.month);
      if (item) {
        item.maintenanceCount += Number(row.count);
        item.maintenanceAmount += Number(row.amount);
        item.totalCount += Number(row.count);
        item.totalAmount += Number(row.amount);
      }
    });

    // 6. 按状态统计
    const [engStatusResult] = await pool.execute(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as amount
       FROM engineering_quotes
       WHERE 1=1 ${userCondition.replace('user_id', 'created_by')}
       GROUP BY status`,
      userParams
    );
    
    const [maintStatusResult] = await pool.execute(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as amount
       FROM maintenance_quotes
       WHERE 1=1 ${userCondition.replace('user_id', 'created_by')}
       GROUP BY status`,
      userParams
    );

    const [recordsStatusResult] = await pool.execute(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
       FROM quotation_records
       WHERE 1=1 ${userCondition}
       GROUP BY status`,
      userParams
    );
    
    const statusMap = new Map();
    [...(engStatusResult as any[]), ...(maintStatusResult as any[]), ...(recordsStatusResult as any[])].forEach(row => {
      const key = row.status || 'unknown';
      if (!statusMap.has(key)) {
        statusMap.set(key, { status: key, count: 0, amount: 0 });
      }
      const item = statusMap.get(key);
      item.count += Number(row.count);
      item.amount += Number(row.amount);
    });
    const byStatus = Array.from(statusMap.values());

    // 7. 最近的报价记录（混合工程和维保 + 成员端报价）
    const recentQuotes: any[] = [];
    
    const [recentEngResult] = await pool.execute(
      `SELECT 
        id, quote_number, project_name, client_name, total, status, 'engineering' as type,
        created_by, created_by_name, created_at
      FROM engineering_quotes
      ORDER BY created_at DESC
      LIMIT 20`
    );
    
    const [recentMaintResult] = await pool.execute(
      `SELECT 
        id, quote_number, project_name, client_name, total, status, 'maintenance' as type,
        created_by, created_by_name, created_at
      FROM maintenance_quotes
      ORDER BY created_at DESC
      LIMIT 20`
    );

    const [recentRecordsResult] = await pool.execute(
      `SELECT 
        q.id, 
        json_extract(q.quote_data, '$.quoteNumber') as quote_number,
        q.project_name,
        q.client_name,
        q.total_amount as total,
        q.status,
        'maintenance' as type,
        q.user_id as created_by,
        COALESCE(u.name, u.username) as created_by_name,
        q.created_at
      FROM quotation_records q
      LEFT JOIN users u ON q.user_id = u.id
      ORDER BY q.created_at DESC
      LIMIT 20`
    );

    const allRecent = [
      ...(recentEngResult as any[]),
      ...(recentMaintResult as any[]),
      ...(recentRecordsResult as any[])
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalCount,
          totalAmount,
          avgAmount,
          engineeringCount,
          engineeringAmount,
          maintenanceCount,
          maintenanceAmount
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
