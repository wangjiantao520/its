import { NextRequest, NextResponse } from 'next/server';

// 使用用户提供的API key
const API_KEY = 'sk-8331d86303ac402aaed94b601e2befd0';

export async function POST(request: NextRequest) {
  console.log('[AI] 收到解析请求');
  
  try {
    const { text } = await request.json();
    console.log('[AI] 输入文本:', text);

    // 从用户输入中提取设备信息
    const devices: any[] = [];
    const missingFields: string[] = [];
    const suggestions: string[] = [];

    // 分析地区
    let region: string | undefined;
    if (text.includes('城区')) region = '城区';
    else if (text.includes('乡镇')) region = '乡镇';
    else if (text.includes('农村')) region = '农村';
    else if (text.includes('县城')) region = '市区县城郊区';
    else missingFields.push('region');

    // 分析设备 - 简单的关键词匹配
    const devicePatterns = [
      { name: '台式电脑', pattern: /台式电脑|台品电脑|台机|台式机/g },
      { name: '笔记本电脑', pattern: /笔记本电脑|笔记本|便携机/g },
      { name: '电动装订机', pattern: /电动装订机|装订机/g },
      { name: '手动装订机', pattern: /手动装订机/g },
      { name: '打印机', pattern: /打印机/g },
      { name: '复印机', pattern: /复印机/g },
      { name: '扫描仪', pattern: /扫描仪/g },
      { name: '触控一体机', pattern: /触控一体机|一体机/g },
      { name: '服务器', pattern: /服务器/g },
    ];

    const matchedDevices = new Set<string>();

    for (const device of devicePatterns) {
      if (device.pattern.test(text)) {
        matchedDevices.add(device.name);
      }
    }

    // 为每个匹配的设备创建设备对象
    let deviceIndex = 0;
    for (const deviceName of matchedDevices) {
      // 尝试提取数量
      let quantity = 10;
      const quantityMatch = text.match(/(\d+)\s*台/);
      if (quantityMatch && deviceIndex === 0) {
        quantity = parseInt(quantityMatch[1]);
      }

      // 尝试提取使用年限
      let useYears = 5;
      const yearMatch = text.match(/(\d+)\s*年/);
      if (yearMatch && deviceIndex === 0) {
        useYears = parseInt(yearMatch[1]);
      }

      // 检查是否在保
      let underWarranty = false;
      if (text.includes('在保')) {
        underWarranty = true;
      }

      devices.push({
        rawText: text,
        deviceName: deviceName,
        model: undefined,
        quantity: quantity,
        useYears: useYears,
        underWarranty: underWarranty,
        confidence: 0.8,
        warnings: []
      });
      
      deviceIndex++;
    }

    // 如果没有匹配到设备，添加默认设备
    if (devices.length === 0) {
      devices.push({
        rawText: text,
        deviceName: '台式电脑',
        model: undefined,
        quantity: 10,
        useYears: 5,
        underWarranty: false,
        confidence: 0.8,
        warnings: []
      });
    }

    // 检查其他缺失字段
    if (!text.includes('合同') && !text.includes('年')) {
      missingFields.push('contractYears');
    }
    if (!text.includes('巡检')) {
      missingFields.push('annualInspectionCount');
    }
    if (!text.includes('响应')) {
      missingFields.push('responseTime');
    }
    if (!text.includes('到场')) {
      missingFields.push('arrivalTime');
    }

    // 生成建议
    if (missingFields.length > 0) {
      suggestions.push(`请确认服务地区、合同年限和巡检次数`);
    }
    if (devices.length > 0) {
      suggestions.push(`已识别${devices.length}个设备，请检查设备信息是否正确`);
    }

    const mockResult = {
      customerName: undefined,
      projectName: undefined,
      region: region,
      contractYears: 1,
      annualInspectionCount: 4,
      responseTime: undefined,
      arrivalTime: undefined,
      serviceTime: undefined,
      notes: undefined,
      devices: devices,
      missingFields: missingFields,
      suggestions: suggestions,
      quotaList: []
    };

    console.log('[AI] 返回模拟结果，设备数:', devices.length);
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
