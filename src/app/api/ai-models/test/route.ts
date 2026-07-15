import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';

// POST - 测试AI模型连接
export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const testPrompt = body.prompt || '你好，请用一句话介绍你自己。';

    let config: any = null;
    let configId: number | null = null;

    // 如果传了id，从数据库读取配置
    if (id) {
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.execute(
          'SELECT * FROM ai_model_configs WHERE id = ?',
          [id]
        );
        config = (rows as any[])[0];
        configId = config?.id;
      } finally {
        connection.release();
      }
    } else {
      // 否则使用body中的配置（用于未保存的临时测试）
      config = body;
    }

    if (!config) {
      return NextResponse.json(
        { success: false, error: '配置不存在' },
        { status: 404 }
      );
    }

    if (!config.api_endpoint || !config.api_key || !config.model_name) {
      return NextResponse.json(
        { success: false, error: '配置不完整，缺少 api_endpoint/api_key/model_name' },
        { status: 400 }
      );
    }

    // 调用AI API进行测试
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    try {
      const response = await fetch(config.api_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.api_key}`,
        },
        body: JSON.stringify({
          model: config.model_name,
          messages: [
            {
              role: 'system',
              content: '你是一个测试助手，请用一句话简短回复。',
            },
            { role: 'user', content: testPrompt },
          ],
          temperature: config.temperature || 0.3,
          max_tokens: Math.min(config.max_tokens || 500, 500),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        // 记录失败日志
        if (configId) {
          try {
            const connection = await pool.getConnection();
            await connection.execute(
              `INSERT INTO ai_model_logs (config_id, provider, model_name, request_type, prompt_length, status, duration_ms, error_message)
              VALUES (?, ?, ?, 'test', ?, 'failed', ?, ?)`,
              [
                configId,
                config.provider,
                config.model_name,
                testPrompt.length,
                duration,
                `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
              ]
            );
            connection.release();
          } catch (dbErr) { console.warn("[AI Models Test] 记录失败: ", dbErr); }
        }

        return NextResponse.json(
          {
            success: false,
            error: `API返回错误 (${response.status})`,
            detail: errorText.substring(0, 500),
            duration,
          },
          { status: 200 }
        );
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '';
      const usage = data.usage;

      // 记录成功日志
      if (configId) {
        try {
          const connection = await pool.getConnection();
          await connection.execute(
            `INSERT INTO ai_model_logs (config_id, provider, model_name, request_type, prompt_length, response_length, status, duration_ms)
            VALUES (?, ?, ?, 'test', ?, ?, 'success', ?)`,
            [configId, config.provider, config.model_name, testPrompt.length, reply.length, duration]
          );
          connection.release();
        } catch (dbErr) { console.warn("[AI Models Test] 记录失败: ", dbErr); }
      }

      return NextResponse.json({
        success: true,
        data: {
          reply: reply.substring(0, 500),
          duration,
          usage,
          model: config.model_name,
          provider: config.provider,
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      const errorMsg = (fetchError as Error).message;

      // 记录失败日志
      if (configId) {
        try {
          const connection = await pool.getConnection();
          await connection.execute(
            `INSERT INTO ai_model_logs (config_id, provider, model_name, request_type, status, duration_ms, error_message)
            VALUES (?, ?, ?, 'test', 'failed', ?, ?)`,
            [configId, config.provider, config.model_name, duration, errorMsg]
          );
          connection.release();
        } catch (dbErr) { console.warn("[AI Models Test] 记录失败: ", dbErr); }
      }

      return NextResponse.json(
        {
          success: false,
          error: '调用失败',
          detail: errorMsg,
          duration,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('[AI Models] 测试连接失败:', error);
    return NextResponse.json(
      { success: false, error: '测试失败', detail: (error as Error).message },
      { status: 500 }
    );
  }
}
