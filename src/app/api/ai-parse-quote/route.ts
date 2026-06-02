import { NextRequest, NextResponse } from 'next/server';
import { FULL_DEVICE_QUOTAS } from '@/lib/complete-device-data';

// 使用用户提供的API key
const API_KEY = 'sk-8331d86303ac402aaed94b601e2befd0';

// 设备匹配函数
function matchDeviceToQuota(deviceName: string): {
  matchedDevice: any;
  confidence: number;
  candidates: any[];
} | null {
  if (!deviceName) return null;
  
  const name = deviceName.toLowerCase();
  
  // 精确匹配
  let exactMatch = FULL_DEVICE_QUOTAS.find((d: any) => 
    d.name.toLowerCase() === name ||
    d.model?.toLowerCase() === name
  );
  
  if (exactMatch) {
    return {
      matchedDevice: exactMatch,
      confidence: 0.95,
      candidates: []
    };
  }
  
  // 模糊匹配
  const candidates = FULL_DEVICE_QUOTAS.filter((d: any) => 
    d.name.toLowerCase().includes(name) || 
    name.includes(d.name.toLowerCase()) ||
    d.category.toLowerCase().includes(name)
  ).slice(0, 3);
  
  if (candidates.length > 0) {
    return {
      matchedDevice: candidates[0],
      confidence: 0.7,
      candidates: candidates.slice(1)
    };
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  console.log('[AI] 收到解析请求');
  
  try {
    const { text } = await request.json();
    console.log('[AI] 输入文本:', text);

    // 简化的系统提示词，加快响应
    const systemPrompt = `你是一个专业的维保报价需求识别助手。请从用户的自然语言描述中提取以下信息，并以JSON格式返回。

需要提取的字段：
- customerName?: string - 客户名称
- projectName?: string - 项目名称
- region?: "城区" | "市区县城郊区" | "乡镇" | "农村" - 服务地区
- contractYears?: number - 合同年限
- annualInspectionCount?: number - 年度巡检次数（每季度=4，每月=12，默认4）
- responseTime?: string - 响应时间（如"30分钟"）
- arrivalTime?: string - 到场时间（如"8小时"）
- serviceTime?: string - 服务时间（如"5x8"）
- notes?: string - 其他备注
- devices: Array<{
    rawText: string; - 原始文本片段
    deviceName?: string; - 设备名称
    model?: string; - 规格型号
    quantity?: number; - 数量
    useYears?: number; - 使用年限
    underWarranty?: boolean; - 是否在保
    confidence: number; - 匹配置信度0-1
    warnings?: string[]; - 警告信息
  }>
- missingFields: string[] - 缺失的字段列表（必填字段：region, contractYears, annualInspectionCount）
- suggestions: string[] - 建议列表

返回格式严格为JSON，不要有其他文本。`;

    // 用户提示词
    const userPrompt = `请从以下需求中提取信息：\n\n${text}`;

    console.log('[AI] 正在调用DeepSeek API...');
    console.log('[AI] 模型: deepseek-v4-pro');

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

    console.log('[AI] DeepSeek API响应状态:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    // 添加超时处理，避免卡住
    const resultPromise = response.json();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('API响应超时')), 30000)
    );
    
    const result = await Promise.race([resultPromise, timeoutPromise]) as any;
    console.log('[AI] DeepSeek API返回:', JSON.stringify(result, null, 2));
    
    const aiResponse = result.choices?.[0]?.message?.content;
    console.log('[AI] AI响应内容:', aiResponse);

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

    console.log('[AI] 解析结果:', parsedResult);

    if (!parsedResult || !parsedResult.devices) {
      // 如果解析失败，返回一个默认结果
      console.log('[AI] 解析失败，返回默认结果');
      return NextResponse.json({
        devices: [],
        missingFields: ['设备清单'],
        suggestions: ['AI解析失败，请重新描述需求'],
      });
    }

    // 确保返回格式正确，添加设备定额库匹配
    const devicesWithQuota = (parsedResult.devices || []).map((d: any) => {
      const match = d.deviceName ? matchDeviceToQuota(d.deviceName) : null;
      
      return {
        rawText: d.rawText || text,
        deviceName: d.deviceName,
        model: d.model,
        quantity: d.quantity,
        useYears: d.useYears,
        underWarranty: d.underWarranty,
        confidence: match ? match.confidence : (d.confidence || 0.7),
        warnings: d.warnings || [],
        matchedDeviceId: match?.matchedDevice?.id,
        matchedDeviceName: match?.matchedDevice?.name,
        candidateDevices: match?.candidates?.map((c: any) => ({
          id: c.id,
          name: c.name,
          category: c.category
        })) || []
      };
    });

    // 检查必填字段
    const requiredFields = [];
    if (!parsedResult.region) requiredFields.push('region');
    if (!parsedResult.contractYears) requiredFields.push('contractYears');
    if (!parsedResult.annualInspectionCount) requiredFields.push('annualInspectionCount');
    
    // 检查设备字段
    devicesWithQuota.forEach((device: any, index: number) => {
      if (!device.quantity) requiredFields.push(`devices[${index}].quantity`);
      if (!device.useYears) requiredFields.push(`devices[${index}].useYears`);
      if (!device.matchedDeviceId) requiredFields.push(`devices[${index}].deviceMatch`);
    });

    const finalResult = {
      customerName: parsedResult.customerName,
      projectName: parsedResult.projectName,
      region: parsedResult.region,
      contractYears: parsedResult.contractYears,
      annualInspectionCount: parsedResult.annualInspectionCount || 4,
      responseTime: parsedResult.responseTime,
      arrivalTime: parsedResult.arrivalTime,
      serviceTime: parsedResult.serviceTime,
      notes: parsedResult.notes,
      devices: devicesWithQuota,
      missingFields: [...new Set([...requiredFields, ...(parsedResult.missingFields || [])])],
      suggestions: parsedResult.suggestions || [],
      quotaList: FULL_DEVICE_QUOTAS.slice(0, 50).map((d: any) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        model: d.model
      }))
    };

    console.log('[AI] 最终返回:', JSON.stringify(finalResult, null, 2));
    console.log('[AI] 解析完成');

    return NextResponse.json(finalResult);
  } catch (error) {
    console.error('[AI] AI解析失败:', error);
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
