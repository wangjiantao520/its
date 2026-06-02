import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[AI] 收到解析请求');
  
  try {
    const { text } = await request.json();
    console.log('[AI] 输入文本:', text);

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

    // 直接检查是否有多种设备
    const hasDesktop = text.includes('台式电脑') || text.includes('台品电脑') || text.includes('台式机');
    const hasLaptop = text.includes('笔记本电脑') || text.includes('笔记本');
    const hasBinder = text.includes('装订机');
    const hasPrinter = text.includes('打印机');
    const hasCopier = text.includes('复印机');
    const hasScanner = text.includes('扫描仪');
    const hasAllInOne = text.includes('触控一体机') || text.includes('一体机');
    const hasServer = text.includes('服务器');

    // 提取所有的数量和年限
    const allNumbers = text.match(/(\d+)/g) || [];
    console.log('[AI] 找到的数字:', allNumbers);

    let numberIndex = 0;

    // 台式电脑
    if (hasDesktop) {
      const quantity = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 10;
      const useYears = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 5;
      devices.push({
        rawText: text,
        deviceName: '台式电脑',
        model: undefined,
        quantity: quantity,
        useYears: useYears,
        underWarranty: text.includes('在保'),
        confidence: 0.8,
        warnings: []
      });
    }

    // 笔记本电脑
    if (hasLaptop) {
      const quantity = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 5;
      const useYears = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 1;
      devices.push({
        rawText: text,
        deviceName: '笔记本电脑',
        model: undefined,
        quantity: quantity,
        useYears: useYears,
        underWarranty: text.includes('在保'),
        confidence: 0.8,
        warnings: []
      });
    }

    // 装订机
    if (hasBinder) {
      const quantity = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 2;
      const useYears = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 3;
      devices.push({
        rawText: text,
        deviceName: text.includes('电动') ? '电动装订机' : '手动装订机',
        model: undefined,
        quantity: quantity,
        useYears: useYears,
        underWarranty: text.includes('在保'),
        confidence: 0.8,
        warnings: []
      });
    }

    // 打印机
    if (hasPrinter) {
      const quantity = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 1;
      const useYears = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 2;
      devices.push({
        rawText: text,
        deviceName: '打印机',
        model: undefined,
        quantity: quantity,
        useYears: useYears,
        underWarranty: text.includes('在保'),
        confidence: 0.8,
        warnings: []
      });
    }

    // 复印机
    if (hasCopier) {
      const quantity = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 1;
      const useYears = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 2;
      devices.push({
        rawText: text,
        deviceName: '复印机',
        model: undefined,
        quantity: quantity,
        useYears: useYears,
        underWarranty: text.includes('在保'),
        confidence: 0.8,
        warnings: []
      });
    }

    // 扫描仪
    if (hasScanner) {
      const quantity = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 1;
      const useYears = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 2;
      devices.push({
        rawText: text,
        deviceName: '扫描仪',
        model: undefined,
        quantity: quantity,
        useYears: useYears,
        underWarranty: text.includes('在保'),
        confidence: 0.8,
        warnings: []
      });
    }

    // 触控一体机
    if (hasAllInOne) {
      const quantity = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 1;
      const useYears = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 2;
      devices.push({
        rawText: text,
        deviceName: '触控一体机',
        model: undefined,
        quantity: quantity,
        useYears: useYears,
        underWarranty: text.includes('在保'),
        confidence: 0.8,
        warnings: []
      });
    }

    // 服务器
    if (hasServer) {
      const quantity = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 1;
      const useYears = numberIndex < allNumbers.length ? parseInt(allNumbers[numberIndex++]) : 2;
      devices.push({
        rawText: text,
        deviceName: '服务器',
        model: undefined,
        quantity: quantity,
        useYears: useYears,
        underWarranty: text.includes('在保'),
        confidence: 0.8,
        warnings: []
      });
    }

    // 如果没有匹配到任何设备，添加默认设备
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

    console.log('[AI] 返回模拟结果，设备数:', devices.length, '设备列表:', devices.map(d => d.deviceName));
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
