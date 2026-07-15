import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';

// POST - 激活指定的AI模型配置（同时取消其他激活状态）
export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少配置ID' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      // 检查配置是否存在
      const [rows] = await connection.execute(
        'SELECT id, name FROM ai_model_configs WHERE id = ?',
        [id]
      );
      if ((rows as any[]).length === 0) {
        return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 });
      }

      // 取消所有激活状态
      await connection.execute('UPDATE ai_model_configs SET is_active = 0');
      // 激活指定配置
      await connection.execute('UPDATE ai_model_configs SET is_active = 1 WHERE id = ?', [id]);

      return NextResponse.json({
        success: true,
        data: { message: '配置已激活', activeId: Number(id) },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[AI Models] 激活配置失败:', error);
    return NextResponse.json(
      { success: false, error: '激活配置失败', detail: (error as Error).message },
      { status: 500 }
    );
  }
}

// GET - 获取当前激活的配置（脱敏）
export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM ai_model_configs WHERE is_active = 1 LIMIT 1'
      );
      const config = (rows as any[])[0];
      if (!config) {
        return NextResponse.json({
          success: true,
          data: null,
          message: '当前没有激活的配置',
        });
      }
      return NextResponse.json({
        success: true,
        data: {
          ...config,
          api_key_masked: config.api_key
            ? `${config.api_key.substring(0, 4)}...${config.api_key.substring(config.api_key.length - 4)}`
            : '',
          api_key: undefined,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    // 数据库不可用时回退到环境变量
    const envKey = process.env.DEEPSEEK_API_KEY || '';
    return NextResponse.json({
      success: true,
      data: {
        id: 0,
        name: '环境变量默认配置',
        provider: 'deepseek',
        model_name: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
        api_endpoint: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
        api_key_masked: envKey
          ? `${envKey.substring(0, 4)}...${envKey.substring(envKey.length - 4)}`
          : '',
        is_active: 1,
        is_default: 1,
        source: 'env',
        message: '数据库不可用，当前使用环境变量配置',
      },
    });
  }
}
