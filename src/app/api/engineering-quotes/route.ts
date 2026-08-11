import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

interface CountRow extends Record<string, unknown> { total: string | number }
interface IdRow extends Record<string, unknown> { id: string | number | bigint }
interface OwnerRow extends Record<string, unknown> { created_by: string | null }

function objectBody(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function validNonNegative(value: unknown): boolean {
  return value === undefined || value === null || value === ''
    || (Number.isFinite(Number(value)) && Number(value) >= 0);
}

function safeInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('limit') || '10', 10) || 10));
    const keyword = request.nextUrl.searchParams.get('keyword')?.trim() || '';
    const status = request.nextUrl.searchParams.get('status')?.trim() || '';
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (keyword) {
      values.push(`%${keyword}%`);
      conditions.push(`(project_name ILIKE $${values.length} OR client_name ILIKE $${values.length} OR quote_number ILIKE $${values.length})`);
    }
    if (status) { values.push(status); conditions.push(`status = $${values.length}`); }
    if (auth.session.role !== 'admin') {
      values.push(String(auth.session.userId ?? -1));
      conditions.push(`created_by = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const database = getDatabase();
    const count = await database.query<CountRow>(`SELECT COUNT(*)::text AS total FROM engineering_quotes ${where}`, values);
    const total = Number(count.rows[0]?.total ?? 0);
    const listValues = [...values, limit, (page - 1) * limit];
    const rows = await database.query<Record<string, unknown>>(
      `SELECT * FROM engineering_quotes ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      listValues,
    );
    return NextResponse.json({ success: true, data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('获取工程报价列表失败:', error);
    return NextResponse.json({ success: false, error: '获取工程报价列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const body = objectBody(await request.json());
    if (!body || typeof body.quoteNumber !== 'string' || !body.quoteNumber.trim()
      || typeof body.projectName !== 'string' || !body.projectName.trim()) {
      return NextResponse.json({ success: false, error: '报价编号和项目名称不能为空' }, { status: 400 });
    }
    const numericFields = ['constructionArea', 'managementRate', 'profitRate', 'regulatoryRate', 'taxRate', 'subtotal', 'managementFee', 'profit', 'regulatoryFee', 'tax', 'total', 'crccRate', 'crccFee', 'cmccRate', 'cmccFee'];
    const invalid = numericFields.find((field) => !validNonNegative(body[field]));
    if (invalid) return NextResponse.json({ success: false, error: `${invalid} 必须是有效的非负数` }, { status: 400 });
    if (body.items !== undefined && !Array.isArray(body.items)) {
      return NextResponse.json({ success: false, error: '报价明细格式无效' }, { status: 400 });
    }
    const createdBy = String(auth.session.userId ?? auth.session.username ?? -1);
    const inserted = await getDatabase().query<IdRow>(`
      INSERT INTO engineering_quotes
        (quote_number, project_name, client_name, contact_person, contact_phone,
         construction_area, management_rate, profit_rate, regulatory_rate, tax_rate,
         subtotal, management_fee, profit, regulatory_fee, tax, total,
         crcc_rate, crcc_fee, cmcc_rate, cmcc_fee,
         items, created_by, created_by_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23)
      RETURNING id
    `, [
      body.quoteNumber.trim(), body.projectName.trim(), body.clientName ?? null, body.contactPerson ?? null,
      body.contactPhone ?? null, body.constructionArea ?? 0, body.managementRate ?? 0.08,
      body.profitRate ?? 0.1, body.regulatoryRate ?? 0.01, body.taxRate ?? 0.13,
      body.subtotal ?? 0, body.managementFee ?? 0, body.profit ?? 0, body.regulatoryFee ?? 0,
      body.tax ?? 0, body.total ?? 0, body.crccRate ?? 0, body.crccFee ?? 0,
      body.cmccRate ?? 0, body.cmccFee ?? 0, JSON.stringify(body.items ?? []), createdBy,
      auth.session.name || auth.session.username || auth.session.role,
    ]);
    return NextResponse.json({ success: true, data: { id: String(inserted.rows[0]?.id) } });
  } catch (error) {
    console.error('创建工程报价失败:', error);
    return NextResponse.json({ success: false, error: '创建工程报价失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const body = objectBody(await request.json());
    const id = safeInteger(body?.id);
    if (!body || !id) return NextResponse.json({ success: false, error: '缺少报价ID' }, { status: 400 });
    if (typeof body.quoteNumber !== 'string' || !body.quoteNumber.trim() || typeof body.projectName !== 'string' || !body.projectName.trim()) {
      return NextResponse.json({ success: false, error: '报价编号和项目名称不能为空' }, { status: 400 });
    }
    const numericFields = ['constructionArea', 'managementRate', 'profitRate', 'regulatoryRate', 'taxRate', 'subtotal', 'managementFee', 'profit', 'regulatoryFee', 'tax', 'total', 'crccRate', 'crccFee', 'cmccRate', 'cmccFee'];
    const invalid = numericFields.find((field) => !validNonNegative(body[field]));
    if (invalid) return NextResponse.json({ success: false, error: `${invalid} 必须是有效的非负数` }, { status: 400 });
    if (body.items !== undefined && !Array.isArray(body.items)) return NextResponse.json({ success: false, error: '报价明细格式无效' }, { status: 400 });
    const database = getDatabase();
    const owner = await database.query<OwnerRow>('SELECT created_by FROM engineering_quotes WHERE id = $1', [id]);
    if (!owner.rows[0]) return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 });
    if (auth.session.role !== 'admin' && owner.rows[0].created_by !== String(auth.session.userId ?? -1)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }
    const updated = await database.query<IdRow>(`
      UPDATE engineering_quotes SET quote_number=$1, project_name=$2, client_name=$3,
        contact_person=$4, contact_phone=$5, construction_area=$6, management_rate=$7,
        profit_rate=$8, regulatory_rate=$9, tax_rate=$10, subtotal=$11, management_fee=$12,
        profit=$13, regulatory_fee=$14, tax=$15, total=$16,
        crcc_rate=$17, crcc_fee=$18, cmcc_rate=$19, cmcc_fee=$20,
        items=$21::jsonb, status=$22,
        updated_at=CURRENT_TIMESTAMP WHERE id=$23 RETURNING id
    `, [body.quoteNumber.trim(), body.projectName.trim(), body.clientName ?? null, body.contactPerson ?? null,
      body.contactPhone ?? null, body.constructionArea ?? 0, body.managementRate ?? 0.08,
      body.profitRate ?? 0.1, body.regulatoryRate ?? 0.01, body.taxRate ?? 0.13, body.subtotal ?? 0,
      body.managementFee ?? 0, body.profit ?? 0, body.regulatoryFee ?? 0, body.tax ?? 0, body.total ?? 0,
      body.crccRate ?? 0, body.crccFee ?? 0, body.cmccRate ?? 0, body.cmccFee ?? 0,
      JSON.stringify(body.items ?? []), body.status ?? 'draft', id]);
    if (!updated.rows[0]) return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('更新工程报价失败:', error);
    return NextResponse.json({ success: false, error: '更新工程报价失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const body = objectBody(await request.json());
    const id = safeInteger(body?.id);
    if (!id) return NextResponse.json({ success: false, error: '无效的报价ID' }, { status: 400 });
    const database = getDatabase();
    const deleted = await database.transaction(async (client) => {
      await client.query('DELETE FROM quote_versions WHERE quote_type = $1 AND quote_id = $2', ['engineering', id]);
      await client.query('DELETE FROM quote_audit_logs WHERE quote_type = $1 AND quote_id = $2', ['engineering', id]);
      await client.query('DELETE FROM quote_shares WHERE quote_type = $1 AND quote_id = $2', ['engineering', id]);
      return client.query<IdRow>('DELETE FROM engineering_quotes WHERE id = $1 RETURNING id', [id]);
    });
    if (!deleted.rows[0]) return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 });
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除工程报价失败:', error);
    return NextResponse.json({ success: false, error: '删除工程报价失败' }, { status: 500 });
  }
}
