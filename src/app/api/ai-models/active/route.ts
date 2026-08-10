import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { maskApiKey } from '@/lib/ai-providers';
import { getDatabase } from '@/lib/database/client';

interface AIModelRow extends Record<string, unknown> {
  id: string | number | bigint;
  api_key: string;
  is_active: boolean;
  is_default: boolean;
}

interface IdRow extends Record<string, unknown> {
  id: string | number | bigint;
}

function parseId(request: NextRequest): string | null {
  const id = request.nextUrl.searchParams.get('id');
  return id && /^\d+$/.test(id) && BigInt(id) > BigInt(0) ? id : null;
}

function serializeId(value: string | number | bigint): string {
  return String(value);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = parseId(request);
  if (!id) {
    return NextResponse.json({ success: false, error: '缺少配置ID' }, { status: 400 });
  }

  try {
    const activated = await getDatabase().transaction(async (database) => {
      await database.query(
        "SELECT pg_advisory_xact_lock(hashtext('ai_model_configs:state'))",
      );
      const existing = await database.query<IdRow>(
        'SELECT id FROM ai_model_configs WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!existing.rows[0]) return null;

      await database.query('UPDATE ai_model_configs SET is_active = false WHERE is_active = true');
      const updated = await database.query<IdRow>(
        `UPDATE ai_model_configs
         SET is_active = true, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id`,
        [id],
      );
      return updated.rows[0] ?? null;
    });

    if (!activated) {
      return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: { message: '配置已激活', activeId: serializeId(activated.id) },
    });
  } catch (error) {
    console.error('[AI Models] 激活配置失败:', error);
    return NextResponse.json({ success: false, error: '激活配置失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await getDatabase().query<AIModelRow>(
      `SELECT * FROM ai_model_configs
       WHERE is_active = true
       ORDER BY is_default DESC, sort_order ASC, id DESC
       LIMIT 1`,
    );
    const config = result.rows[0];
    if (!config) {
      return NextResponse.json({ success: true, data: null, message: '当前没有激活的配置' });
    }
    const { api_key: apiKey, ...safe } = config;
    return NextResponse.json({
      success: true,
      data: {
        ...safe,
        id: serializeId(config.id),
        is_active: config.is_active ? 1 : 0,
        is_default: config.is_default ? 1 : 0,
        api_key_masked: maskApiKey(apiKey),
      },
    });
  } catch (error) {
    console.warn('[AI Models] 数据库不可用，回退环境变量:', error);
    const envKey = process.env.DEEPSEEK_API_KEY || '';
    return NextResponse.json({
      success: true,
      data: {
        id: 0,
        name: '环境变量默认配置',
        provider: 'deepseek',
        model_name: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        api_endpoint: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
        api_key_masked: envKey ? maskApiKey(envKey) : '',
        is_active: 1,
        is_default: 1,
        source: 'env',
        message: '数据库不可用，当前使用环境变量配置',
      },
    });
  }
}
