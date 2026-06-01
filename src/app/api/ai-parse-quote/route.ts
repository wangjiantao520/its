import { NextRequest, NextResponse } from 'next/server';

// 使用用户提供的API key
const API_KEY = 'sk-8331d86303ac402aaed94b601e2befd0';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    // 系统提示词
    const systemPrompt = `你是一个专业的维保报价需求识别助手。请从用户的自然语言描述中提取以下信息，并以JSON格式返回。

需要提取的字段：
- customerName?: string - 客户名称
- projectName?: string - 项目名称
- region?: "城区" | "市区县城郊区" | "乡镇" | "农村" - 服务地区
- contractYears?: number - 合同年限
- annualInspectionCount?: number - 年度巡检次数（每季度=4，每月=12）
- responseTime?: string - 响应时间
- arrivalTime?: string - 到场时间
- serviceTime?: string - 服务时间
- notes?: string - 其他备注
- devices: Array<{
    rawText: string; - 原始文本片段
    deviceName?: string; - 设备名称
    model?: string; - 规格型号
    quantity?: number; - 数量
    useYears?: number; - 使用年限
    confidence: number; - 匹配置信度0-1
    warnings?: string[]; - 警告信息
  }>
- missingFields: string[] - 缺失的字段列表
- suggestions: string[] - 建议列表

返回格式严格为JSON，不要有其他文本。`;

    // 用户提示词
    const userPrompt = `请从以下需求中提取信息：\n\n${text}`;

    // 调用DeepSeek API（兼容格式）
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // 尝试解析AI返回的JSON
    let parsedResult;
    try {
      // 提取JSON部分
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsedResult = null;
    }

    if (!parsedResult || !parsedResult.devices) {
      // 如果解析失败，返回一个默认结果
      return NextResponse.json({
        devices: [],
        missingFields: ['设备清单'],
        suggestions: ['AI解析失败，请重新描述需求'],
      });
    }

    // 确保返回格式正确
    const finalResult = {
      customerName: parsedResult.customerName,
      projectName: parsedResult.projectName,
      region: parsedResult.region,
      contractYears: parsedResult.contractYears,
      annualInspectionCount: parsedResult.annualInspectionCount,
      responseTime: parsedResult.responseTime,
      arrivalTime: parsedResult.arrivalTime,
      serviceTime: parsedResult.serviceTime,
      notes: parsedResult.notes,
      devices: (parsedResult.devices || []).map((d: any) => ({
        rawText: d.rawText || text,
        deviceName: d.deviceName,
        model: d.model,
        quantity: d.quantity,
        useYears: d.useYears,
        confidence: d.confidence || 0.7,
        warnings: d.warnings,
      })),
      missingFields: parsedResult.missingFields || [],
      suggestions: parsedResult.suggestions || [],
    };

    return NextResponse.json(finalResult);
  } catch (error) {
    console.error('AI解析失败:', error);
    return NextResponse.json(
      {
        devices: [],
        missingFields: ['设备清单'],
        suggestions: ['AI服务暂时不可用，请稍后重试'],
      },
      { status: 500 }
    );
  }
}
