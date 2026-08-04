import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { PROVIDER_PRESETS, maskApiKey } from '@/lib/ai-providers';
import { validateBody } from '@/lib/api-validate';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';

interface AIModelRow extends Record<string, unknown> {
  id: string | number | bigint;
  api_key: string;
  is_active: boolean;
  is_default: boolean;
}

interface IdRow extends Record<string, unknown> {
  id: string | number | bigint;
}

interface ModelStateRow extends Record<string, unknown> {
  is_active: boolean;
  is_default: boolean;
}

const booleanValue = z.preprocess((value) => {
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return value;
}, z.boolean());
const provider = z.string().min(1, 'provider 不能为空').refine(
  (value) => Object.keys(PROVIDER_PRESETS).includes(value),
  { message: '不支持的提供商' },
);
const aiModelSchema = z.object({
  name: z.string().trim().min(1, 'name 不能为空').max(100),
  provider,
  model_name: z.string().trim().min(1, 'model_name 不能为空').max(200),
  api_endpoint: z.string().trim().min(1, 'api_endpoint 不能为空').url('api_endpoint 必须是合法 URL'),
  api_key: z.string().min(1, 'api_key 不能为空'),
  temperature: z.coerce.number().finite().min(0).max(2).optional().default(0.3),
  max_tokens: z.coerce.number().int().positive().max(128000).optional().default(3000),
  system_prompt: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  is_active: booleanValue.optional().default(true),
  is_default: booleanValue.optional().default(false),
  sort_order: z.coerce.number().int().nonnegative().optional().default(0),
  created_by: z.string().optional().default('system'),
});
const aiModelUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  provider: provider.optional(),
  model_name: z.string().trim().min(1).max(200).optional(),
  api_endpoint: z.string().trim().url('api_endpoint 必须是合法 URL').optional(),
  api_key: z.string().optional(),
  temperature: z.coerce.number().finite().min(0).max(2).optional(),
  max_tokens: z.coerce.number().int().positive().max(128000).optional(),
  system_prompt: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  is_active: booleanValue.optional(),
  is_default: booleanValue.optional(),
  sort_order: z.coerce.number().int().nonnegative().optional(),
});

function parseId(request: NextRequest): string | null {
  const id = request.nextUrl.searchParams.get('id');
  return id && /^\d+$/.test(id) && BigInt(id) > BigInt(0) ? id : null;
}

function serializeId(value: string | number | bigint): string {
  return String(value);
}

function serializeModel(row: AIModelRow): Record<string, unknown> {
  const { api_key: apiKey, ...safe } = row;
  return {
    ...safe,
    id: serializeId(row.id),
    is_active: row.is_active ? 1 : 0,
    is_default: row.is_default ? 1 : 0,
    api_key_masked: maskApiKey(apiKey),
  };
}

async function lockModelState(database: DatabaseClient): Promise<void> {
  await database.query(
    "SELECT pg_advisory_xact_lock(hashtext('ai_model_configs:state'))",
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const configs = await getDatabase().query<AIModelRow>(
      `SELECT * FROM ai_model_configs
       ORDER BY is_active DESC, is_default DESC, sort_order ASC, id DESC`,
    );
    return NextResponse.json({
      success: true,
      data: configs.rows.map(serializeModel),
      presets: PROVIDER_PRESETS,
    });
  } catch (error) {
    console.error('[AI Models] 获取配置列表失败:', error);
    return NextResponse.json({ success: false, error: '获取AI模型配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, aiModelSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const inserted = await getDatabase().transaction(async (database) => {
      const data = parsed.data;
      if (data.is_default || data.is_active) {
        await lockModelState(database);
      }
      if (data.is_default) {
        await database.query('UPDATE ai_model_configs SET is_default = false WHERE is_default = true');
      }
      if (data.is_active) {
        await database.query('UPDATE ai_model_configs SET is_active = false WHERE is_active = true');
      }
      return database.query<IdRow>(
        `INSERT INTO ai_model_configs
           (name, provider, model_name, api_endpoint, api_key, temperature, max_tokens,
            system_prompt, description, is_default, is_active, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          data.name, data.provider, data.model_name, data.api_endpoint, data.api_key,
          data.temperature, data.max_tokens, data.system_prompt || null, data.description || null,
          data.is_default, data.is_active, data.sort_order, data.created_by || 'system',
        ],
      );
    });
    const row = inserted.rows[0];
    if (!row) throw new Error('AI model insert did not return an id');
    return NextResponse.json({
      success: true,
      data: { id: serializeId(row.id), message: 'AI模型配置创建成功' },
    });
  } catch (error) {
    console.error('[AI Models] 创建配置失败:', error);
    return NextResponse.json({ success: false, error: '创建配置失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = parseId(request);
  if (!id) {
    return NextResponse.json({ success: false, error: '缺少配置ID' }, { status: 400 });
  }
  const parsed = await validateBody(request, aiModelUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const fields: string[] = [];
  const params: unknown[] = [];
  const add = (field: string, value: unknown): void => {
    params.push(value);
    fields.push(`${field} = $${params.length}`);
  };
  for (const [field, value] of Object.entries(parsed.data)) {
    if (field === 'api_key' && value === '') continue;
    if (value !== undefined) add(field, value);
  }
  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: '没有要更新的字段' }, { status: 400 });
  }

  try {
    const updated = await getDatabase().transaction(async (database) => {
      const changesState = parsed.data.is_default !== undefined || parsed.data.is_active !== undefined;
      if (changesState) {
        await lockModelState(database);
        const existing = await database.query<IdRow>(
          'SELECT id FROM ai_model_configs WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (!existing.rows[0]) return { rows: [], rowCount: 0 };
      }
      if (parsed.data.is_default === true) {
        await database.query(
          'UPDATE ai_model_configs SET is_default = false WHERE is_default = true AND id <> $1',
          [id],
        );
      }
      if (parsed.data.is_active === true) {
        await database.query(
          'UPDATE ai_model_configs SET is_active = false WHERE is_active = true AND id <> $1',
          [id],
        );
      }
      params.push(id);
      return database.query<IdRow>(
        `UPDATE ai_model_configs
         SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length}
         RETURNING id`,
        params,
      );
    });
    if (!updated.rows[0]) {
      return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { message: '配置更新成功' } });
  } catch (error) {
    console.error('[AI Models] 更新配置失败:', error);
    return NextResponse.json({ success: false, error: '更新配置失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = parseId(request);
  if (!id) {
    return NextResponse.json({ success: false, error: '缺少配置ID' }, { status: 400 });
  }

  try {
    const deleted = await getDatabase().transaction(async (database) => {
      await lockModelState(database);
      const state = await database.query<ModelStateRow>(
        'SELECT is_active, is_default FROM ai_model_configs WHERE id = $1 FOR UPDATE',
        [id],
      );
      const config = state.rows[0];
      if (!config) return { outcome: 'missing' } as const;
      if (config.is_active) return { outcome: 'active' } as const;
      if (config.is_default) return { outcome: 'default' } as const;
      const result = await database.query<IdRow>(
        'DELETE FROM ai_model_configs WHERE id = $1 RETURNING id',
        [id],
      );
      return result.rows[0]
        ? { outcome: 'deleted' } as const
        : { outcome: 'missing' } as const;
    });
    if (deleted.outcome === 'missing') {
      return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 });
    }
    if (deleted.outcome === 'active') {
      return NextResponse.json(
        { success: false, error: '不能删除当前激活的配置，请先切换其他配置' },
        { status: 400 },
      );
    }
    if (deleted.outcome === 'default') {
      return NextResponse.json(
        { success: false, error: '不能删除默认配置，请先取消默认设置' },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, data: { message: '配置已删除' } });
  } catch (error) {
    console.error('[AI Models] 删除配置失败:', error);
    return NextResponse.json({ success: false, error: '删除配置失败' }, { status: 500 });
  }
}
