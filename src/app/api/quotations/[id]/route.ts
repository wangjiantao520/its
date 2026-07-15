import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { pool, type DbRows } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const [records] = await pool.execute(
      'SELECT q.*, u.name, u.username FROM quotation_records q LEFT JOIN users u ON q.user_id = u.id WHERE q.id = ?',
      [id],
    );
    const record = (records as DbRows)[0];
    if (!record) {
      return NextResponse.json({ success: false, error: '报价记录不存在' }, { status: 404 });
    }
    if (auth.session.role !== 'admin' && Number(record.user_id) !== auth.session.userId) {
      return NextResponse.json({ success: false, error: '无权查看该报价' }, { status: 403 });
    }

    let quoteData: unknown = null;
    if (typeof record.quote_data === 'string') {
      try {
        quoteData = JSON.parse(record.quote_data);
      } catch {
        quoteData = null;
      }
    }

    const [devices] = await pool.execute(
      'SELECT * FROM quotation_devices WHERE quotation_id = ?',
      [id],
    );

    return NextResponse.json({
      success: true,
      data: { ...record, quote_data: quoteData, devices },
    });
  } catch (error) {
    console.error('获取报价记录详情失败:', error);
    return NextResponse.json({ success: false, error: '获取报价记录详情失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const [records] = await pool.execute(
      'SELECT id, user_id FROM quotation_records WHERE id = ?',
      [id],
    );
    const record = (records as DbRows)[0];
    if (!record) {
      return NextResponse.json({ success: false, error: '报价记录不存在' }, { status: 404 });
    }
    if (auth.session.role !== 'admin' && Number(record.user_id) !== auth.session.userId) {
      return NextResponse.json({ success: false, error: '无权删除该报价' }, { status: 403 });
    }

    await pool.execute('DELETE FROM quotation_devices WHERE quotation_id = ?', [id]);
    await pool.execute('DELETE FROM quotation_records WHERE id = ?', [id]);
    return NextResponse.json({ success: true, data: { id: Number(id) } });
  } catch (error) {
    console.error('删除报价记录失败:', error);
    return NextResponse.json({ success: false, error: '删除报价记录失败' }, { status: 500 });
  }
}
