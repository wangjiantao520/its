import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function modelName(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (!isRecord(value)) return null;
  if (typeof value.id === 'string' && value.id.trim()) return value.id;
  if (typeof value.name === 'string' && value.name.trim()) return value.name;
  return null;
}

// 获取指定API Key可用的模型列表
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const rawBody: unknown = await request.json();
    const body = isRecord(rawBody) ? rawBody : {};
    const apiEndpoint = typeof body.api_endpoint === 'string' ? body.api_endpoint : '';
    const apiKey = typeof body.api_key === 'string' ? body.api_key : '';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API Key 不能为空' },
        { status: 400 }
      );
    }

    // 构造models API的URL
    let modelsUrl = '';
    
    if (apiEndpoint) {
      // 从endpoint中提取基础URL
      // 例如: https://api.deepseek.com/v1/chat/completions -> https://api.deepseek.com/v1/models
      const urlObj = new URL(apiEndpoint);
      const pathParts = urlObj.pathname.split('/');
      // 移除最后一部分（chat/completions），添加models
      pathParts.pop(); // 移除 completions
      pathParts.pop(); // 移除 chat
      pathParts.push('models');
      modelsUrl = `${urlObj.origin}${pathParts.join('/')}`;
    }

    if (!modelsUrl) {
      return NextResponse.json(
        { success: false, error: '无法确定模型列表API地址' },
        { status: 400 }
      );
    }

    console.log(`[AI Models] 获取模型列表: ${modelsUrl}`);

    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI Models] 获取模型列表失败: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { 
          success: false, 
          error: `获取模型列表失败 (${response.status})`,
          detail: errorText
        },
        { status: response.status }
      );
    }

    const data: unknown = await response.json();
    
    // 提取模型列表
    let models: string[] = [];
    
    if (isRecord(data) && Array.isArray(data.data)) {
      // OpenAI兼容格式
      models = data.data.map(modelName).filter((name): name is string => name !== null);
    } else if (isRecord(data) && Array.isArray(data.models)) {
      models = data.models.map(modelName).filter((name): name is string => name !== null);
    } else if (Array.isArray(data)) {
      models = data.map(modelName).filter((name): name is string => name !== null);
    }

    // 去重并排序
    models = [...new Set(models)].sort();

    console.log(`[AI Models] 获取到 ${models.length} 个模型`);

    return NextResponse.json({
      success: true,
      models: models,
      count: models.length,
    });
  } catch (error) {
    console.error('[AI Models] 获取模型列表异常:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取模型列表失败',
        detail: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : undefined
      },
      { status: 500 }
    );
  }
}
