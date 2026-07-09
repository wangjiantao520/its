import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/quotations/[id] - 获取报价记录详情
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // 获取报价记录
    const [records] = await pool.execute(
      'SELECT q.*, u.real_name, u.username FROM quotation_records q LEFT JOIN users u ON q.user_id = u.id WHERE q.id = ?',
      [id]
    );

    const recordList = records as any[];
    if (recordList.length === 0) {
      return NextResponse.json({ error: '报价记录不存在' }, { status: 404 });
    }

    const record = recordList[0];

    // 解析quote_data
    let quoteData = null;
    if (record.quote_data) {
      try {
        quoteData = JSON.parse(record.quote_data);
      } catch (e) {
        quoteData = null;
      }
    }

    // 获取设备明细
    const [devices] = await pool.execute(
      'SELECT * FROM quotation_devices WHERE quotation_id = ?',
      [id]
    );

    return NextResponse.json({
      ...record,
      quote_data: quoteData,
      devices
    });
  } catch (error) {
    console.error('获取报价记录详情失败:', error);
    return NextResponse.json({ error: '获取报价记录详情失败' }, { status: 500 });
  }
}

// DELETE /api/quotations/[id] - 删除报价记录
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // 先删除设备明细
    await pool.execute('DELETE FROM quotation_devices WHERE quotation_id = ?', [id]);
    // 再删除报价记录
    await pool.execute('DELETE FROM quotation_records WHERE id = ?', [id]);

    return NextResponse.json({ message: '报价记录删除成功' });
  } catch (error) {
    console.error('删除报价记录失败:', error);
    return NextResponse.json({ error: '删除报价记录失败' }, { status: 500 });
  }
}
