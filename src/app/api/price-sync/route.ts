import { NextRequest, NextResponse } from 'next/server';

// 价格同步API：价格变更时重新计算AI识别结果
// 这里复用ai-parse-quote的逻辑
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { devices, region, serviceMode, serviceTime, needSpareParts } = body;

    if (!devices || !Array.isArray(devices) || devices.length === 0) {
      return NextResponse.json(
        { success: false, error: '设备列表不能为空' },
        { status: 400 }
      );
    }

    // 重新计算预估价格
    const priceMap: Record<string, { min: number; max: number }> = {
      '台式电脑': { min: 800, max: 1500 },
      '笔记本电脑': { min: 1000, max: 1800 },
      '打印机': { min: 1500, max: 3000 },
      '复印机': { min: 3000, max: 8000 },
      '服务器': { min: 5000, max: 15000 },
      '网络设备': { min: 2000, max: 5000 },
      '监控设备': { min: 1000, max: 3000 },
      '扫描仪': { min: 800, max: 2000 },
      '装订机': { min: 500, max: 1500 },
      '其他': { min: 500, max: 2000 },
    };

    const regionFactor: Record<string, number> = {
      '城区': 1.0,
      '市区县城郊区': 0.95,
      '乡镇': 0.9,
      '农村': 0.85,
    };

    const serviceModeFactor: Record<string, number> = {
      '远程': 1.0,
      '混合': 1.25,
      '驻场': 1.5,
    };

    const serviceTimeFactor: Record<string, number> = {
      '5x8': 1.0,
      '7x8': 1.15,
      '7x24': 1.3,
    };

    let totalMin = 0;
    let totalMax = 0;

    devices.forEach((device: any) => {
      const price = priceMap[device.deviceName] || priceMap['其他'];
      const quantity = device.quantity || 1;
      const useYears = device.useYears || 2;
      const ageFactor = useYears <= 1 ? 1.0 : useYears <= 3 ? 0.9 : 0.8;

      totalMin += price.min * quantity * ageFactor;
      totalMax += price.max * quantity * ageFactor;
    });

    const rFactor = regionFactor[region] || 1.0;
    const sFactor = serviceModeFactor[serviceMode] || 1.0;
    const tFactor = serviceTimeFactor[serviceTime] || 1.0;

    // 备件加价 10-20%
    const sparePartsFactor = needSpareParts ? 1.15 : 1.0;

    const result = {
      success: true,
      estimatedPriceRange: {
        min: Math.round(totalMin * rFactor * sFactor * tFactor * sparePartsFactor),
        max: Math.round(totalMax * rFactor * sFactor * tFactor * sparePartsFactor),
        unit: '元/年',
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Price Sync] 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET: 获取当前价格版本信息
export async function GET() {
  return NextResponse.json({
    success: true,
    priceVersion: '2025-01-15-v1',
    lastUpdated: new Date().toISOString(),
    priceTable: {
      '台式电脑': { min: 800, max: 1500 },
      '笔记本电脑': { min: 1000, max: 1800 },
      '打印机': { min: 1500, max: 3000 },
      '复印机': { min: 3000, max: 8000 },
      '服务器': { min: 5000, max: 15000 },
      '网络设备': { min: 2000, max: 5000 },
      '监控设备': { min: 1000, max: 3000 },
      '扫描仪': { min: 800, max: 2000 },
      '装订机': { min: 500, max: 1500 },
      '其他': { min: 500, max: 2000 },
    },
    regionFactor: {
      '城区': 1.0,
      '市区县城郊区': 0.95,
      '乡镇': 0.9,
      '农村': 0.85,
    },
  });
}
