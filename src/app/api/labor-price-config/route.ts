import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { validateBody } from '@/lib/api-validate';
import { getDatabase } from '@/lib/database/client';

interface LaborPriceRow extends Record<string, unknown> {
  id: string | number | bigint;
  level: string;
  unit_price: string | number;
  unit: string | null;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface IdRow extends Record<string, unknown> {
  id: string | number | bigint;
}

const decimalId = z.union([
  z.number().int().positive().safe(),
  z.string().regex(/^\d+$/, 'id 必须是正整数'),
]);
const booleanValue = z.preprocess((value) => {
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return value;
}, z.boolean());
const createSchema = z.object({
  level: z.string().trim().min(1),
  unitPrice: z.coerce.number().finite().nonnegative(),
  unit: z.string().optional().default('人天'),
  description: z.string().optional().default(''),
  sortOrder: z.coerce.number().int().nonnegative().optional().default(0),
});
const updateSchema = z.object({
  id: decimalId,
  level: z.string().trim().min(1).optional(),
  unitPrice: z.coerce.number().finite().nonnegative().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
  isActive: booleanValue.optional(),
});
const deleteSchema = z.object({ id: decimalId });

function serializeId(value: string | number | bigint): string | number {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : parsed.toString();
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const activeOnly = request.nextUrl.searchParams.get('active_only') === 'true';
    const rows = await getDatabase().query<LaborPriceRow>(
      `SELECT * FROM labor_price_config${activeOnly ? ' WHERE is_active = $1' : ''}
       ORDER BY sort_order ASC, id ASC`,
      activeOnly ? [true] : [],
    );
    return NextResponse.json({
      success: true,
      data: rows.rows.map((row) => ({
        id: serializeId(row.id),
        level: row.level,
        unitPrice: Number(row.unit_price),
        unit: row.unit || '人天',
        description: row.description || '',
        sortOrder: row.sort_order || 0,
        isActive: row.is_active,
        createdAt: serializeDate(row.created_at),
        updatedAt: serializeDate(row.updated_at),
      })),
    });
  } catch (error) {
    console.error('获取人工单价配置失败:', error);
    return NextResponse.json({ success: false, error: '获取人工单价配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, createSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const created = await getDatabase().transaction(async (database) => {
      const { level, unitPrice, unit, description, sortOrder } = parsed.data;
      await database.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`labor_price_config:${level}`]);
      const existing = await database.query<IdRow>(
        'SELECT id FROM labor_price_config WHERE level = $1',
        [level],
      );
      if (existing.rows[0]) return null;
      const inserted = await database.query<IdRow>(
        `INSERT INTO labor_price_config
           (level, unit_price, unit, description, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [level, unitPrice, unit || '人天', description, sortOrder, true],
      );
      return inserted.rows[0];
    });

    if (!created) {
      return NextResponse.json(
        { success: false, error: `人员等级「${parsed.data.level}」已存在` },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, data: { id: serializeId(created.id) } });
  } catch (error) {
    console.error('新增人工单价档位失败:', error);
    return NextResponse.json({ success: false, error: '新增人工单价档位失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, updateSchema);
  if (!parsed.ok) return parsed.response;

  const { id, ...changes } = parsed.data;
  const fields: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown): void => {
    params.push(value);
    fields.push(`${column} = $${params.length}`);
  };
  if (changes.level !== undefined) add('level', changes.level);
  if (changes.unitPrice !== undefined) add('unit_price', changes.unitPrice);
  if (changes.unit !== undefined) add('unit', changes.unit || '人天');
  if (changes.description !== undefined) add('description', changes.description);
  if (changes.sortOrder !== undefined) add('sort_order', changes.sortOrder);
  if (changes.isActive !== undefined) add('is_active', changes.isActive);
  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: '没有要更新的字段' }, { status: 400 });
  }

  try {
    params.push(id);
    const updated = await getDatabase().query<IdRow>(
      `UPDATE labor_price_config
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length}
       RETURNING id`,
      params,
    );
    if (!updated.rows[0]) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id: serializeId(updated.rows[0].id) } });
  } catch (error) {
    console.error('更新人工单价档位失败:', error);
    return NextResponse.json({ success: false, error: '更新人工单价档位失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const deleted = await getDatabase().query<IdRow>(
      'DELETE FROM labor_price_config WHERE id = $1 RETURNING id',
      [parsed.data.id],
    );
    if (!deleted.rows[0]) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除人工单价档位失败:', error);
    return NextResponse.json({ success: false, error: '删除人工单价档位失败' }, { status: 500 });
  }
}
