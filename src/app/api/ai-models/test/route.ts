import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

interface TestConfig extends Record<string, unknown> {
  id?: string | number | bigint;
  provider?: string;
  model_name?: string;
  api_endpoint?: string;
  api_key?: string;
  temperature?: string | number;
  max_tokens?: string | number;
}

interface AIResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function writeTestLog(
  config: TestConfig,
  values: {
    promptLength?: number;
    responseLength?: number;
    status: 'success' | 'failed';
    duration: number;
    errorMessage?: string;
  },
): Promise<void> {
  if (config.id === undefined || !config.provider || !config.model_name) return;
  try {
    await getDatabase().query(
      `INSERT INTO ai_model_logs
         (config_id, provider, model_name, request_type, prompt_length, response_length,
          status, duration_ms, error_message)
       VALUES ($1, $2, $3, 'test', $4, $5, $6, $7, $8)`,
      [
        config.id,
        config.provider,
        config.model_name,
        values.promptLength ?? null,
        values.responseLength ?? null,
        values.status,
        values.duration,
        values.errorMessage ?? null,
      ],
    );
  } catch (error) {
    console.warn('[AI Models Test] 记录失败:', error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  try {
    const id = request.nextUrl.searchParams.get('id');
    const rawBody: unknown = await request.json().catch(() => ({}));
    const body = isRecord(rawBody) ? rawBody : {};
    const testPrompt = typeof body.prompt === 'string'
      ? body.prompt
      : '你好，请用一句话介绍你自己。';

    let config: TestConfig | null;
    if (id) {
      if (!/^\d+$/.test(id) || BigInt(id) <= BigInt(0)) {
        return NextResponse.json({ success: false, error: '配置ID无效' }, { status: 400 });
      }
      const rows = await getDatabase().query<TestConfig>(
        'SELECT * FROM ai_model_configs WHERE id = $1',
        [id],
      );
      config = rows.rows[0] ?? null;
    } else {
      config = body as TestConfig;
    }

    if (!config) {
      return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 });
    }
    if (!config.api_endpoint || !config.api_key || !config.model_name) {
      return NextResponse.json(
        { success: false, error: '配置不完整，缺少 api_endpoint/api_key/model_name' },
        { status: 400 },
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
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
            { role: 'system', content: '你是一个测试助手，请用一句话简短回复。' },
            { role: 'user', content: testPrompt },
          ],
          temperature: Number(config.temperature) || 0.3,
          max_tokens: Math.min(Number(config.max_tokens) || 500, 500),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        await writeTestLog(config, {
          promptLength: testPrompt.length,
          status: 'failed',
          duration,
          errorMessage: `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
        });
        return NextResponse.json({
          success: false,
          error: `API返回错误 (${response.status})`,
          detail: errorText.substring(0, 500),
          duration,
        });
      }

      const data = await response.json() as AIResponse;
      const content = data.choices?.[0]?.message?.content;
      const reply = typeof content === 'string' ? content : '';
      await writeTestLog(config, {
        promptLength: testPrompt.length,
        responseLength: reply.length,
        status: 'success',
        duration,
      });
      return NextResponse.json({
        success: true,
        data: {
          reply: reply.substring(0, 500),
          duration,
          usage: data.usage,
          model: config.model_name,
          provider: config.provider,
        },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await writeTestLog(config, { status: 'failed', duration, errorMessage });
      return NextResponse.json({
        success: false,
        error: '调用失败',
        detail: errorMessage,
        duration,
      });
    }
  } catch (error) {
    console.error('[AI Models] 测试连接失败:', error);
    return NextResponse.json({ success: false, error: '测试失败' }, { status: 500 });
  }
}
