import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { validateBody } from '@/lib/api-validate';
import { getDatabase } from '@/lib/database/client';

interface CountRow extends Record<string, unknown> {
  total: string | number | bigint;
}

interface IdRow extends Record<string, unknown> {
  id: string;
}

const finiteNonNegative = z.coerce.number().finite().nonnegative();
const quotaSchema = z.object({
  id: z.string().trim().min(1),
  serialNumber: z.coerce.number().int().nonnegative().optional().default(0),
  category: z.string().trim().min(1),
  name: z.string().trim().min(1),
  brandModel: z.string().optional().default(''),
  description: z.string().optional().default(''),
  deductibleTaxRate: finiteNonNegative.optional().default(0),
  unit: z.string().trim().min(1),
  price: finiteNonNegative,
  remark: z.string().optional().default(''),
  sortOrder: z.coerce.number().int().nonnegative().optional().default(0),
});
const deleteSchema = z.object({ id: z.string().trim().min(1) });

function parseCount(value: string | number | bigint): number {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('intelligent_project_quotas count exceeds JavaScript safe integer range');
  }
  return Number(parsed);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword') || '';
    const category = searchParams.get('category') || '';
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.max(1, Math.min(200, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (keyword) {
      params.push(`%${keyword}%`);
      conditions.push(
        `(name ILIKE $${params.length} OR id ILIKE $${params.length}
          OR COALESCE(remark, '') ILIKE $${params.length}
          OR COALESCE(brand_model, '') ILIKE $${params.length}
          OR COALESCE(description, '') ILIKE $${params.length})`,
      );
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const database = getDatabase();
    const countResult = await database.query<CountRow>(
      `SELECT COUNT(*) AS total FROM intelligent_project_quotas${whereClause}`,
      params,
    );
    const total = parseCount(countResult.rows[0]?.total ?? 0);
    const rows = await database.query<Record<string, unknown>>(
      `SELECT * FROM intelligent_project_quotas${whereClause}
       ORDER BY sort_order ASC, serial_number ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return NextResponse.json({
      success: true,
      data: rows.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('获取智能化项目定额列表失败:', error);
    return NextResponse.json({ success: false, error: '获取智能化项目定额列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, quotaSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const data = parsed.data;
    const inserted = await getDatabase().query<IdRow>(
      `INSERT INTO intelligent_project_quotas
         (id, item_id, serial_number, category, name, brand_model, description,
          deductible_tax_rate, unit, price, remark, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        data.id, data.id, data.serialNumber, data.category, data.name, data.brandModel,
        data.description, data.deductibleTaxRate, data.unit, data.price, data.remark, data.sortOrder,
      ],
    );
    return NextResponse.json({ success: true, data: { id: inserted.rows[0]?.id ?? data.id } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ success: false, error: '定额编号已存在' }, { status: 400 });
    }
    console.error('新增智能化项目定额失败:', error);
    return NextResponse.json({ success: false, error: '新增智能化项目定额失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, quotaSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const data = parsed.data;
    const updated = await getDatabase().query<IdRow>(
      `UPDATE intelligent_project_quotas
       SET serial_number = $1, category = $2, name = $3, brand_model = $4,
           description = $5, deductible_tax_rate = $6, unit = $7, price = $8,
           remark = $9, sort_order = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING id`,
      [
        data.serialNumber, data.category, data.name, data.brandModel, data.description,
        data.deductibleTaxRate, data.unit, data.price, data.remark, data.sortOrder, data.id,
      ],
    );
    if (!updated.rows[0]) {
      return NextResponse.json({ success: false, error: '定额项不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id: updated.rows[0].id } });
  } catch (error) {
    console.error('编辑智能化项目定额失败:', error);
    return NextResponse.json({ success: false, error: '编辑智能化项目定额失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const deleted = await getDatabase().query<IdRow>(
      'DELETE FROM intelligent_project_quotas WHERE id = $1 RETURNING id',
      [parsed.data.id],
    );
    if (!deleted.rows[0]) {
      return NextResponse.json({ success: false, error: '定额项不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除智能化项目定额失败:', error);
    return NextResponse.json({ success: false, error: '删除智能化项目定额失败' }, { status: 500 });
  }
}
