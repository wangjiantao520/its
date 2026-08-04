import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

type RouteContext = { params: Promise<{ id: string }> };
interface QuotationRow extends Record<string, unknown> { id: string | number | bigint; user_id: string | number | bigint }
interface IdRow extends Record<string, unknown> { id: string | number | bigint }
function idFrom(value: string): number | null { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null; }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const id = idFrom((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的报价ID' }, { status: 400 });
    const database = getDatabase();
    const records = await database.query<QuotationRow>(`
      SELECT quotation.*, owner.name, owner.username FROM quotation_records quotation
      LEFT JOIN users owner ON owner.id = quotation.user_id WHERE quotation.id = $1
    `, [id]);
    const record = records.rows[0];
    if (!record) return NextResponse.json({ success: false, error: '报价记录不存在' }, { status: 404 });
    if (auth.session.role !== 'admin' && Number(record.user_id) !== auth.session.userId) return NextResponse.json({ success: false, error: '无权查看该报价' }, { status: 403 });
    const devices = await database.query<Record<string, unknown>>('SELECT * FROM quotation_devices WHERE quotation_id = $1 ORDER BY id', [id]);
    return NextResponse.json({ success: true, data: { ...record, devices: devices.rows } });
  } catch (error) {
    console.error('获取报价记录详情失败:', error);
    return NextResponse.json({ success: false, error: '获取报价记录详情失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const id = idFrom((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的报价ID' }, { status: 400 });
    const database = getDatabase();
    const record = (await database.query<QuotationRow>('SELECT id, user_id FROM quotation_records WHERE id = $1', [id])).rows[0];
    if (!record) return NextResponse.json({ success: false, error: '报价记录不存在' }, { status: 404 });
    if (auth.session.role !== 'admin' && Number(record.user_id) !== auth.session.userId) return NextResponse.json({ success: false, error: '无权删除该报价' }, { status: 403 });
    await database.transaction(async (client) => {
      await client.query<IdRow>('DELETE FROM quotation_devices WHERE quotation_id = $1 RETURNING id', [id]);
      await client.query<IdRow>('DELETE FROM quotation_records WHERE id = $1 RETURNING id', [id]);
    });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('删除报价记录失败:', error);
    return NextResponse.json({ success: false, error: '删除报价记录失败' }, { status: 500 });
  }
}
