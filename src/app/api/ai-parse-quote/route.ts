import { NextRequest, NextResponse } from 'next/server';

// 使用用户提供的API key
const API_KEY = 'sk-8331d86303ac402aaed94b601e2befd0';

export async function POST(request: NextRequest) {
  console.log('[AI] 收到解析请求');
  
  try {
    const { text } = await request.json();
    console.log('[AI] 输入文本:', text);

    // 先返回一个简单的模拟结果，确保能正常工作
    const mockResult = {
      customerName: undefined,
      projectName: undefined,
      region: text.includes('城区') ? '城区' : (text.includes('乡镇') ? '乡镇' : undefined),
      contractYears: 1,
      annualInspectionCount: 4,
      responseTime: undefined,
      arrivalTime: undefined,
      serviceTime: undefined,
      notes: undefined,
      devices: [
        {
          rawText: text,
          deviceName: '台式电脑',
          model: undefined,
          quantity: 10,
          useYears: 5,
          underWarranty: false,
          confidence: 0.8,
          warnings: []
        }
      ],
      missingFields: ['region', 'contractYears', 'annualInspectionCount'],
      suggestions: ['请确认服务地区、合同年限和巡检次数'],
      quotaList: []
    };

    console.log('[AI] 返回模拟结果');
    return NextResponse.json(mockResult);
    
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
