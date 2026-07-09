import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/quotations - 获取报价记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');
    const offset = (page - 1) * pageSize;

    let query = 'SELECT q.*, u.real_name, u.username FROM quotation_records q LEFT JOIN users u ON q.user_id = u.id';
    const params: any[] = [];

    if (userId) {
      query += ' WHERE q.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY q.created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [records] = await pool.execute(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM quotation_records q';
    const countParams: any[] = [];
    if (userId) {
      countQuery += ' WHERE q.user_id = ?';
      countParams.push(userId);
    }
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = (countResult as any[])[0]?.total || 0;

    return NextResponse.json({
      records,
      total,
      page,
      pageSize
    });
  } catch (error) {
    console.error('获取报价记录失败:', error);
    return NextResponse.json({ error: '获取报价记录失败' }, { status: 500 });
  }
}

// POST /api/quotations - 创建报价记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, client_name, client_region, project_name, quote_type, total_amount, device_count, quote_data, devices } = body;

    if (!user_id || !client_name) {
      return NextResponse.json({ error: '用户ID和客户名称不能为空' }, { status: 400 });
    }

    // 创建报价记录
    const result = await pool.execute(
      'INSERT INTO quotation_records (user_id, client_name, client_region, project_name, quote_type, total_amount, device_count, quote_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, client_name, client_region || null, project_name || null, quote_type || 'full', total_amount || 0, device_count || 0, quote_data ? JSON.stringify(quote_data) : null]
    );

    const quotationId = (result as any).insertId;

    // 保存设备明细
    if (devices && Array.isArray(devices) && devices.length > 0) {
      for (const device of devices) {
        await pool.execute(
          'INSERT INTO quotation_devices (quotation_id, device_name, brand, model, category, quantity, unit_price, total_price, maintenance_rate, maintenance_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            quotationId,
            device.device_name || device.name,
            device.brand || null,
            device.model || null,
            device.category || null,
            device.quantity || 1,
            device.unit_price || 0,
            device.total_price || 0,
            device.maintenance_rate || 0,
            device.maintenance_fee || 0
          ]
        );
      }
    }

    return NextResponse.json({ 
      message: '报价记录保存成功',
      id: quotationId 
    }, { status: 201 });
  } catch (error) {
    console.error('保存报价记录失败:', error);
    return NextResponse.json({ error: '保存报价记录失败' }, { status: 500 });
  }
}
