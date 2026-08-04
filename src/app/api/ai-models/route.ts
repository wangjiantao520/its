import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';
import { PROVIDER_PRESETS, maskApiKey } from '@/lib/ai-providers';
import { validateBody } from '@/lib/api-validate';
import { z } from 'zod';

const aiModelSchema = z.object({
  name: z.string().min(1, 'name 不能为空').max(100),
  provider: z.string().min(1, 'provider 不能为空').refine(
    (p) => Object.keys(PROVIDER_PRESETS).includes(p),
    { message: '不支持的提供商' },
  ),
  model_name: z.string().min(1, 'model_name 不能为空').max(200),
  api_endpoint: z.string().min(1, 'api_endpoint 不能为空').url('api_endpoint 必须是合法 URL'),
  api_key: z.string().min(1, 'api_key 不能为空'),
  temperature: z.coerce.number().min(0).max(2).optional().default(0.3),
  max_tokens: z.coerce.number().int().positive().max(128000).optional().default(3000),
  system_prompt: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  is_default: z.coerce.boolean().optional().default(false),
  sort_order: z.coerce.number().int().nonnegative().optional().default(0),
  created_by: z.string().optional().default('system'),
});

// AI模型配置管理 - 支持DeepSeek/OpenAI/豆包/通义千问等多家厂商

// GET - 获取所有AI模型配置列表
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const connection = await pool.getConnection();
    try {
      const sql = 'SELECT * FROM ai_model_configs ORDER BY is_active DESC, is_default DESC, sort_order ASC, id DESC';

      const [rows] = await connection.execute(sql);
      const configs = (rows as any[]).map((row) => ({
        ...row,
        api_key_masked: maskApiKey(row.api_key),
        api_key: undefined, // 不返回完整key
      }));

      return NextResponse.json({
        success: true,
        data: configs,
        presets: PROVIDER_PRESETS,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[AI Models] 获取配置列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取AI模型配置失败' },
      { status: 500 },
    );
  }
}

// POST - 创建新的AI模型配置
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const parsed = await validateBody(request, aiModelSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const {
      name, provider, model_name, api_endpoint, api_key,
      temperature, max_tokens, system_prompt, description,
      is_default, sort_order, created_by,
    } = parsed.data;

    const connection = await pool.getConnection();
    try {
      // 如果设置为默认，先取消其他默认
      if (is_default) {
        await connection.execute('UPDATE ai_model_configs SET is_default = 0 WHERE is_default = 1');
      }

      const [result] = await connection.execute(
        `INSERT INTO ai_model_configs
        (name, provider, model_name, api_endpoint, api_key, temperature, max_tokens, system_prompt, description, is_default, sort_order, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          provider,
          model_name,
          api_endpoint,
          api_key,
          temperature,
          max_tokens,
          system_prompt || null,
          description || null,
          is_default ? 1 : 0,
          sort_order,
          created_by || 'system',
        ]
      );

      const insertId = (result as { insertId?: number | bigint }).insertId;
      return NextResponse.json({
        success: true,
        data: { id: insertId, message: 'AI模型配置创建成功' },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[AI Models] 创建配置失败:', error);
    const isDbError = (error as Error).message?.includes('ECONNREFUSED') || (error as any).code === 'ECONNREFUSED';
    return NextResponse.json(
      {
        success: false,
        error: isDbError ? '数据库未连接：请启动 MySQL 或 Docker 后重试' : '创建配置失败',
        detail: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}

// PUT - 更新AI模型配置（通过query参数指定id）
export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少配置ID' }, { status: 400 });
    }

    const body = await request.json();
    const allowedFields = [
      'name',
      'provider',
      'model_name',
      'api_endpoint',
      'api_key',
      'temperature',
      'max_tokens',
      'system_prompt',
      'description',
      'is_default',
      'sort_order',
    ];

    const connection = await pool.getConnection();
    try {
      // 如果设置为默认，先取消其他默认
      if (body.is_default) {
        await connection.execute('UPDATE ai_model_configs SET is_default = 0 WHERE is_default = 1 AND id != ?', [id]);
      }

      const setClauses: string[] = [];
      const values: any[] = [];
      for (const field of allowedFields) {
        if (field === 'api_key' && body[field] === '') continue;
        if (body[field] !== undefined) {
          setClauses.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (setClauses.length === 0) {
        return NextResponse.json({ success: false, error: '没有要更新的字段' }, { status: 400 });
      }

      values.push(id);
      await connection.execute(
        `UPDATE ai_model_configs SET ${setClauses.join(', ')} WHERE id = ?`,
        values
      );

      return NextResponse.json({ success: true, data: { message: '配置更新成功' } });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[AI Models] 更新配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新配置失败', detail: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined },
      { status: 500 }
    );
  }
}

// DELETE - 删除AI模型配置
export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少配置ID' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      // 检查是否是激活配置
      const [rows] = await connection.execute(
        'SELECT is_active, is_default FROM ai_model_configs WHERE id = ?',
        [id]
      );
      const config = (rows as any[])[0];
      if (!config) {
        return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 });
      }
      if (config.is_active) {
        return NextResponse.json(
          { success: false, error: '不能删除当前激活的配置，请先切换其他配置' },
          { status: 400 }
        );
      }
      if (config.is_default) {
        return NextResponse.json(
          { success: false, error: '不能删除默认配置，请先取消默认设置' },
          { status: 400 }
        );
      }

      await connection.execute('DELETE FROM ai_model_configs WHERE id = ?', [id]);
      return NextResponse.json({ success: true, data: { message: '配置已删除' } });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[AI Models] 删除配置失败:', error);
    return NextResponse.json(
      { success: false, error: '删除配置失败', detail: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined },
      { status: 500 }
    );
  }
}
