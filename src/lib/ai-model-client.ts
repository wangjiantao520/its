export interface AIModelConfig {
  id: number;
  name: string;
  provider: string;
  model_name: string;
  api_endpoint: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
}

interface AIClientOptions {
  temperature?: number;
  maxTokens?: number;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

export async function callAIModelWithConfig(
  config: AIModelConfig,
  messages: Array<{ role: string; content: string }>,
  options: AIClientOptions = {},
): Promise<{ success: boolean; content?: string; error?: string; config: AIModelConfig }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const response = await (options.fetcher ?? fetch)(config.api_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        model: config.model_name,
        messages,
        temperature: options.temperature ?? config.temperature,
        max_tokens: options.maxTokens ?? config.max_tokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { success: false, error: `API调用失败 (${response.status})`, config };
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return { success: false, error: 'AI服务返回格式异常', config };
    }
    const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })
      ?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      return { success: false, error: 'AI服务返回格式异常', config };
    }

    return { success: true, content, config };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'AI服务调用超时', config };
    }
    return {
      success: false,
      error: '调用失败: ' + (error instanceof Error ? error.message : String(error)),
      config,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
