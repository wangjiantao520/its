import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

interface CountRow extends Record<string, unknown> { total: string | number }
interface IdRow extends Record<string, unknown> { id: string | number | bigint }

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function positiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('limit') || '10', 10) || 10));
    const values: unknown[] = [];
    const ownerWhere = auth.session.role === 'admin' ? '' : 'WHERE created_by = $1';
    if (ownerWhere) values.push(String(auth.session.userId ?? -1));
    const database = getDatabase();
    const count = await database.query<CountRow>(`SELECT COUNT(*)::text AS total FROM maintenance_quotes ${ownerWhere}`, values);
    const total = Number(count.rows[0]?.total ?? 0);
    const rows = await database.query<Record<string, unknown>>(
      `SELECT * FROM maintenance_quotes ${ownerWhere} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit],
    );
    return NextResponse.json({ success: true, data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    console.error('获取维保报价列表失败:', error);
    return NextResponse.json({ success: false, error: '获取维保报价列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const body = record(await request.json());
    if (!body || typeof body.quoteNumber !== 'string' || !body.quoteNumber.trim() || typeof body.projectName !== 'string' || !body.projectName.trim()) {
      return NextResponse.json({ success: false, error: '报价编号和项目名称不能为空' }, { status: 400 });
    }
    const numericFields = ['subtotalBeforeDiscount', 'slaAdjustment', 'regionAdjustment', 'subtotalAfterCoefficients', 'yearsDiscount', 'bulkDiscount', 'yearsDiscountAmount', 'bulkDiscountAmount', 'tax', 'total'];
    const invalid = numericFields.find((field) => body[field] !== undefined && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0));
    if (invalid) return NextResponse.json({ success: false, error: `${invalid} 必须是有效的非负数字` }, { status: 400 });
    if (body.devices !== undefined && !Array.isArray(body.devices)) return NextResponse.json({ success: false, error: '设备明细格式无效' }, { status: 400 });
    const inserted = await getDatabase().query<IdRow>(`
      INSERT INTO maintenance_quotes
        (quote_number, project_name, client_name, contact_person, contact_phone, region,
         service_years, engineer_level, sla_config, subtotal_before_discount, sla_adjustment,
         region_adjustment, subtotal_after_coefficients, years_discount, bulk_discount,
         years_discount_amount, bulk_discount_amount, tax, total, devices, created_by, created_by_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,$22)
      RETURNING id
    `, [body.quoteNumber.trim(), body.projectName.trim(), body.clientName ?? null, body.contactPerson ?? null,
      body.contactPhone ?? null, body.region ?? '城区', body.serviceYears ?? 1, body.engineerLevel ?? '中级',
      JSON.stringify(body.slaConfig ?? {}), body.subtotalBeforeDiscount ?? 0, body.slaAdjustment ?? 0,
      body.regionAdjustment ?? 0, body.subtotalAfterCoefficients ?? 0, body.yearsDiscount ?? 1,
      body.bulkDiscount ?? 1, body.yearsDiscountAmount ?? 0, body.bulkDiscountAmount ?? 0,
      body.tax ?? 0, body.total ?? 0, JSON.stringify(body.devices ?? []),
      String(auth.session.userId ?? auth.session.username ?? -1), auth.session.name || auth.session.username || auth.session.role]);
    return NextResponse.json({ success: true, data: { id: String(inserted.rows[0]?.id) } });
  } catch (error) {
    console.error('创建维保报价失败:', error);
    return NextResponse.json({ success: false, error: '创建维保报价失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const body = record(await request.json());
    const id = positiveId(body?.id);
    if (!id) return NextResponse.json({ success: false, error: '无效的报价ID' }, { status: 400 });
    const database = getDatabase();
    const deleted = await database.transaction(async (client) => {
      await client.query('DELETE FROM quote_versions WHERE quote_type = $1 AND quote_id = $2', ['maintenance', id]);
      await client.query('DELETE FROM quote_audit_logs WHERE quote_type = $1 AND quote_id = $2', ['maintenance', id]);
      await client.query('DELETE FROM quote_shares WHERE quote_type = $1 AND quote_id = $2', ['maintenance', id]);
      return client.query<IdRow>('DELETE FROM maintenance_quotes WHERE id = $1 RETURNING id', [id]);
    });
    if (!deleted.rows[0]) return NextResponse.json({ success: false, error: '报价不存在或已删除' }, { status: 404 });
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除维保报价失败:', error);
    return NextResponse.json({ success: false, error: '删除维保报价失败' }, { status: 500 });
  }
}
