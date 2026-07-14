import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/quotes - 获取报价记录列表（合并工程、维保、成员端报价）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // all | engineering | maintenance
    const status = searchParams.get('status');
    const userId = searchParams.get('user_id');
    const keyword = searchParams.get('keyword')?.trim();
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');
    const offset = (page - 1) * pageSize;

    // 从三张表合并查询，字段名统一
    const unions: string[] = [];
    const params: any[] = [];

    // 工程报价
    if (type === 'all' || type === 'engineering') {
      let q = `SELECT 
        id, 
        quote_number, 
        project_name, 
        client_name, 
        'engineering' as quote_type,
        total as total_amount, 
        status, 
        created_by,
        created_by_name, 
        created_at, 
        updated_at
      FROM engineering_quotes WHERE 1=1`;
      const p: any[] = [];
      if (status) { q += ' AND status = ?'; p.push(status); }
      if (userId) { q += ' AND created_by = ?'; p.push(userId); }
      if (keyword) {
        q += ' AND (project_name LIKE ? OR client_name LIKE ? OR quote_number LIKE ?)';
        p.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }
      unions.push(q);
      params.push(...p);
    }

    // 维保报价（管理端）
    if (type === 'all' || type === 'maintenance') {
      let q = `SELECT 
        id, 
        quote_number, 
        project_name, 
        client_name, 
        'maintenance' as quote_type,
        total as total_amount, 
        status, 
        created_by,
        created_by_name, 
        created_at, 
        updated_at
      FROM maintenance_quotes WHERE 1=1`;
      const p: any[] = [];
      if (status) { q += ' AND status = ?'; p.push(status); }
      if (userId) { q += ' AND created_by = ?'; p.push(userId); }
      if (keyword) {
        q += ' AND (project_name LIKE ? OR client_name LIKE ? OR quote_number LIKE ?)';
        p.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }
      unions.push(q);
      params.push(...p);
    }

    // 成员端报价（quotation_records）
    if (type === 'all' || type === 'maintenance') {
      let q = `SELECT 
        id,
        COALESCE(json_extract(quote_data, '$.quoteNumber'), 'Q' || id) as quote_number,
        COALESCE(project_name, json_extract(quote_data, '$.projectName'), '') as project_name,
        client_name,
        COALESCE(quote_type, 'maintenance') as quote_type,
        total_amount,
        COALESCE(status, 'draft') as status,
        user_id as created_by,
        (SELECT name FROM users WHERE id = user_id) as created_by_name,
        created_at,
        updated_at
      FROM quotation_records WHERE 1=1`;
      const p: any[] = [];
      if (status) { q += ' AND status = ?'; p.push(status); }
      if (userId) { q += ' AND user_id = ?'; p.push(userId); }
      if (keyword) {
        q += ' AND (client_name LIKE ? OR project_name LIKE ?)';
        p.push(`%${keyword}%`, `%${keyword}%`);
      }
      unions.push(q);
      params.push(...p);
    }

    if (unions.length === 0) {
      return NextResponse.json({ success: true, data: [], total: 0, page, pageSize });
    }

    const unionSql = unions.join(' UNION ALL ');

    // 总数
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM (${unionSql}) as t`,
      params
    );
    const total = (countResult as any[])[0]?.total || 0;

    // 分页数据
    const [records] = await pool.execute(
      `SELECT * FROM (${unionSql}) as t 
       ORDER BY t.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return NextResponse.json({
      success: true,
      data: records,
      total,
      page,
      pageSize
    });
  } catch (error) {
    console.error('获取报价列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取报价列表失败' },
      { status: 500 }
    );
  }
}
