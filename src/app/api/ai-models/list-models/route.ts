import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';

// 获取指定API Key可用的模型列表
export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { provider, api_endpoint, api_key } = body;

    if (!api_key) {
      return NextResponse.json(
        { success: false, error: 'API Key 不能为空' },
        { status: 400 }
      );
    }

    // 构造models API的URL
    let modelsUrl = '';
    
    if (api_endpoint) {
      // 从endpoint中提取基础URL
      // 例如: https://api.deepseek.com/v1/chat/completions -> https://api.deepseek.com/v1/models
      const urlObj = new URL(api_endpoint);
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
        'Authorization': `Bearer ${api_key}`,
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

    const data = await response.json();
    
    // 提取模型列表
    let models: string[] = [];
    
    if (data.data && Array.isArray(data.data)) {
      // OpenAI兼容格式
      models = data.data.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (data.models && Array.isArray(data.models)) {
      models = data.models.map((m: any) => m.id || m.name || m).filter(Boolean);
    } else if (Array.isArray(data)) {
      models = data.map((m: any) => m.id || m.name || m).filter(Boolean);
    }

    // 去重并排序
    models = [...new Set(models)].sort();

    console.log(`[AI Models] 获取到 ${models.length} 个模型`);

    return NextResponse.json({
      success: true,
      models: models,
      count: models.length,
    });
  } catch (error: any) {
    console.error('[AI Models] 获取模型列表异常:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取模型列表失败',
        detail: error.message
      },
      { status: 500 }
    );
  }
}
