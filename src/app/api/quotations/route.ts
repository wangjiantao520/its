import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';

interface IdRow extends Record<string, unknown> { id: string | number | bigint }
interface CountRow extends Record<string, unknown> { total: string | number }
type DeviceInput = Record<string, unknown>;

function optionalText(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function nonNegative(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function objectBody(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const requested = request.nextUrl.searchParams.get('user_id');
    const userId = auth.session.role === 'admin' ? requested : String(auth.session.userId ?? -1);
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page_size') || '20', 10) || 20));
    const values: unknown[] = [];
    const where = userId ? 'WHERE quotation.user_id = $1' : '';
    if (userId) values.push(userId);
    const database = getDatabase();
    const records = await database.query<Record<string, unknown>>(`
      SELECT quotation.*, owner.name, owner.username FROM quotation_records quotation
      LEFT JOIN users owner ON owner.id = quotation.user_id ${where}
      ORDER BY quotation.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, [...values, pageSize, (page - 1) * pageSize]);
    const count = await database.query<CountRow>(`SELECT COUNT(*)::text AS total FROM quotation_records quotation ${where}`, values);
    return NextResponse.json({ success: true, data: { records: records.rows, total: Number(count.rows[0]?.total ?? 0), page, pageSize } });
  } catch (error) {
    console.error('获取报价记录失败:', error);
    return NextResponse.json({ success: false, error: '获取报价记录失败' }, { status: 500 });
  }
}

async function insertDevices(database: DatabaseClient, quotationId: string | number | bigint, devices: DeviceInput[]): Promise<void> {
  for (const device of devices) {
    await database.query<IdRow>(`
      INSERT INTO quotation_devices
        (quotation_id, device_name, brand, model, category, quantity, unit_price, total_price, maintenance_rate, maintenance_fee)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
    `, [quotationId, optionalText(device.device_name) ?? optionalText(device.name), optionalText(device.brand), optionalText(device.model), optionalText(device.category),
      nonNegative(device.quantity, 1), nonNegative(device.unit_price, 0), nonNegative(device.total_price, 0), nonNegative(device.maintenance_rate, 0), nonNegative(device.maintenance_fee, 0)]);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const body = objectBody(await request.json());
    if (!body || !optionalText(body.client_name)) return NextResponse.json({ success: false, error: '客户名称不能为空' }, { status: 400 });
    const amount = nonNegative(body.total_amount, 0);
    if (amount === null) return NextResponse.json({ success: false, error: '报价金额必须是有效的非负数' }, { status: 400 });
    if (body.devices !== undefined && !Array.isArray(body.devices)) return NextResponse.json({ success: false, error: '设备明细格式无效' }, { status: 400 });
    const devices = (body.devices ?? []) as DeviceInput[];
    const invalidDevice = devices.some((device) => !optionalText(device.device_name) && !optionalText(device.name)
      || [nonNegative(device.quantity, 1), nonNegative(device.unit_price, 0), nonNegative(device.total_price, 0), nonNegative(device.maintenance_rate, 0), nonNegative(device.maintenance_fee, 0)].includes(null));
    if (invalidDevice) return NextResponse.json({ success: false, error: '设备名称不能为空，数量和金额必须是有效的非负数' }, { status: 400 });
    const id = await getDatabase().transaction(async (database) => {
      const inserted = await database.query<IdRow>(`
        INSERT INTO quotation_records (user_id, client_name, client_region, project_name, quote_type, total_amount, device_count, quote_data)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id
      `, [auth.session.userId ?? -1, optionalText(body.client_name), optionalText(body.client_region), optionalText(body.project_name), optionalText(body.quote_type) ?? 'full',
        amount.toFixed(2), nonNegative(body.device_count, devices.length), body.quote_data === undefined || body.quote_data === null ? null : JSON.stringify(body.quote_data)]);
      const quotationId = inserted.rows[0]?.id;
      if (quotationId === undefined) throw new Error('报价记录保存失败');
      await insertDevices(database, quotationId, devices);
      return quotationId;
    });
    return NextResponse.json({ success: true, data: { message: '报价记录保存成功', id: String(id) } }, { status: 201 });
  } catch (error) {
    console.error('保存报价记录失败:', error);
    return NextResponse.json({ success: false, error: '保存报价记录失败' }, { status: 500 });
  }
}
