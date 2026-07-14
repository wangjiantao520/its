import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// AI模型配置管理 - 支持DeepSeek/OpenAI/豆包/通义千问等多家厂商

// 预设的AI模型提供商配置
const PROVIDER_PRESETS: Record<string, { endpoint: string; defaultModel: string; models: string[] }> = {
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-v4-pro',
    models: [
      'deepseek-chat',
      'deepseek-v3-2-251201',
      'deepseek-reasoner',
      'deepseek-v4-pro',
      'deepseek-coder',
      'deepseek-r1',
    ],
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1',
      'o1-mini',
      'o1-preview',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
    ],
  },
  doubao: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    defaultModel: 'doubao-seed-2-0-pro-260215',
    models: [
      'doubao-seed-2-0-pro-260215',
      'doubao-seed-2-0-lite-260215',
      'doubao-seed-2-0-mini-260215',
      'doubao-seed-1-8-251228',
      'doubao-pro-32k',
      'doubao-pro-128k',
      'doubao-lite-32k',
      'doubao-1-5-pro-32k',
    ],
  },
  qwen: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-max',
    models: [
      'qwen-turbo',
      'qwen-plus',
      'qwen-max',
      'qwen-long',
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-7b-instruct',
      'qwen3-46b',
      'qwen3-72b',
      'qwq-32b',
    ],
  },
  moonshot: {
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'moonshot-v1-128k',
    models: [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
      'kimi-k2-5-260127',
      'kimi-k2',
      'moonshot-k2',
    ],
  },
  zhipu: {
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-plus',
    models: [
      'glm-4',
      'glm-4-flash',
      'glm-4-plus',
      'glm-4-air',
      'glm-4-long',
      'glm-5-0-260211',
      'glm-4-0520',
      'glm-3-turbo',
    ],
  },
  minimax: {
    endpoint: 'https://api.minimax.chat/v1/chat/completions',
    defaultModel: 'abab6.5s-chat',
    models: [
      'MiniMax-M1',
      'abab6.5s-chat',
      'abab6.5-chat',
      'abab6-chat',
      'abab5.5-chat',
      'abab5.5-chat-0324',
      'abab5-chat',
      'minimax-text-01',
    ],
  },
  baichuan: {
    endpoint: 'https://api.baichuan-ai.com/v1/chat/completions',
    defaultModel: 'Baichuan4',
    models: [
      'Baichuan4',
      'Baichuan3-Turbo',
      'Baichuan3-Turbo-128k',
      'Baichuan2',
      'Baichuan2-Turbo',
    ],
  },
  custom: {
    endpoint: '',
    defaultModel: '',
    models: [],
  },
};

// 脱敏显示API Key
function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

// GET - 获取所有AI模型配置列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const connection = await pool.getConnection();
    try {
      const sql = includeInactive
        ? 'SELECT * FROM ai_model_configs ORDER BY is_active DESC, is_default DESC, sort_order ASC, id DESC'
        : 'SELECT * FROM ai_model_configs ORDER BY is_active DESC, is_default DESC, sort_order ASC, id DESC';

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
      {
        success: true,
        data: [],
        presets: PROVIDER_PRESETS,
        warning: '数据库未连接，返回空配置列表',
        _offline: true,
      },
      { status: 200 }
    );
  }
}

// POST - 创建新的AI模型配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      provider,
      model_name,
      api_endpoint,
      api_key,
      temperature = 0.3,
      max_tokens = 3000,
      system_prompt,
      description,
      is_default = false,
      sort_order = 0,
      created_by,
    } = body;

    // 验证必填字段
    if (!name || !provider || !model_name || !api_endpoint || !api_key) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：name, provider, model_name, api_endpoint, api_key' },
        { status: 400 }
      );
    }

    // 验证provider
    if (!PROVIDER_PRESETS[provider]) {
      return NextResponse.json(
        { success: false, error: `不支持的提供商: ${provider}` },
        { status: 400 }
      );
    }

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

      const insertId = (result as any)[0]?.insertId;
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
        detail: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// PUT - 更新AI模型配置（通过query参数指定id）
export async function PUT(request: NextRequest) {
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
      { success: false, error: '更新配置失败', detail: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE - 删除AI模型配置
export async function DELETE(request: NextRequest) {
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
      { success: false, error: '删除配置失败', detail: (error as Error).message },
      { status: 500 }
    );
  }
}
