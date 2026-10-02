// 维保分档定义
export type MaintenanceLevel = 'A' | 'B' | 'C' | 'D' | 'E';

// 工程师等级
export type EngineerLevel = '初级' | '中级' | '高级';

// 成新率等级
export type DepreciationLevel = '全新' | '较新' | '一般' | '偏旧' | '老旧';

// 服务时间类型
export type ServiceTimeType = '5×8' | '7×8' | '7×24';

// 地区类型
export type RegionType = '城区' | '市区县城郊区' | '乡镇' | '农村';

// 维保档次配置
// 注意：此为旧版配置，新版数据源为 device-quota-full.ts 的 FULL_MAINTENANCE_LEVEL_CONFIG
// E级 baseFaultCount 已与 device-quota-full.ts 对齐（0.8），
// 新版额外使用 faultCountMultiplier(2.0) 和 complexityFactor(2.0) 进行更精细的计算
export const MAINTENANCE_LEVEL_CONFIG = {
  A: { name: '简易型', baseFaultCount: 1.0, description: '结构简单、即插即用' },
  B: { name: '基础型', baseFaultCount: 2.0, description: '标准办公通用设备' },
  C: { name: '中级型', baseFaultCount: 2.4, description: '结构较复杂' },
  D: { name: '高级型', baseFaultCount: 1.8, description: '集成精密机电' },
  E: { name: '专家型', baseFaultCount: 0.8, description: '大型精密设备' },
};

// 工程师等级单价（元/天）
export const ENGINEER_PRICES = {
  '初级': 404,
  '中级': 543,
  '高级': 700,
};

// 成新率系数
export const DEPRECIATION_FACTORS = {
  '全新': 0.6,
  '较新': 0.8,
  '一般': 1.0,
  '偏旧': 1.3,
  '老旧': 1.6,
};

// 服务时间系数（兼容全角× 与半角x）
export const SERVICE_TIME_FACTORS: Record<string, number> = {
  '5×8': 1.0,
  '5x8': 1.0,
  '7×8': 1.2,
  '7x8': 1.2,
  '7×24': 1.6,
  '7x24': 1.6,
};

// 地区系数
export const REGION_FACTORS = {
  '城区': 1.0,
  '市区县城郊区': 1.1,
  '乡镇': 1.5,
  '农村': 2.0,
};

// 批量折扣（≥50台）
export const BULK_DISCOUNT_THRESHOLD = 50;
export const BULK_DISCOUNT_FACTOR = 0.9;

// 多年期折扣
export const MULTI_YEAR_DISCOUNTS = {
  1: 1.0,
  2: 0.95,
  3: 0.9,
};

// SLA系数配置
export interface SLAConfig {
  teamExperience: number; // 运维团队经验系数 (1.2/1.0/0.8)
  securityLevel: number; // 安全等级系数 (0.9/0.95/1.0/1.05/1.1)
  supportMode: number; // 支持方式系数 (0.89/1.0/1.1)
  faultRecoveryTime: number; // 故障恢复时间系数 (1.2/1.0/0.9/0.85)
  arrivalTime: number; // 到场时间系数 (1.2/1.0)
  responseTime: number; // 响应时间系数 (1.1/1.0)
  serviceTime: ServiceTimeType; // 服务时间
}

// 默认SLA配置
export const DEFAULT_SLA_CONFIG: SLAConfig = {
  teamExperience: 1.2, // 有经验
  securityLevel: 0.95, // 第二级
  supportMode: 1.0, // 现场支持为主
  faultRecoveryTime: 1.0, // ≤24h
  arrivalTime: 1.2, // 2小时
  responseTime: 1.1, // 10分钟
  serviceTime: '5×8',
};

// 计算SLA总系数
export function calculateSLATotalFactor(config: SLAConfig): number {
  const serviceTimeFactor = SERVICE_TIME_FACTORS[config.serviceTime] ?? 1.0;
  return config.teamExperience * config.securityLevel * config.supportMode *
         config.faultRecoveryTime * config.arrivalTime * config.responseTime * serviceTimeFactor;
}

// 设备定额数据结构
export interface DeviceQuota {
  id: string;
  category: string; // 设备分类
  name: string; // 设备名称
  model: string; // 规格/型号
  level: MaintenanceLevel; // 维保分档
  engineerLevel: EngineerLevel; // 工程师等级
  // 巡检费
  inspectionLaborFee: number; // 巡检人工费
  inspectionPersonCount: number; // 巡检人数
  inspectionDuration: number; // 巡检时长（分钟）
  inspectionTimesPerYear: number; // 年基础服务次数
  inspectionContent: string; // 巡检内容
  // 上门费
  trafficFee: number; // 交通费（来回）
  singleTripDuration: number; // 单趟上门时长（分钟）
  connectionDuration: number; // 上门后衔接时长（分钟）
  onSiteConnectionLaborFee: number; // 上门衔接工时费
  // 故障处理费
  inWarrantyFactor: number; // 是否在保系数 (0.5/1.0)
  baseFaultCount: number; // 年故障数基准值
  depreciationFactor: number; // 成新率系数
  faultServiceCount: number; // 故障服务次数
  faultHandlerCount: number; // 故障受理人数
  faultHandlingDuration: number; // 故障受理时长（分钟）
  // 其他费用
  toolAmortization: number; // 工具仪表摊销
  toolDetails: string; // 维保涉及工具仪表明细
  consumableFee: number; // 耗材费
  consumableDetails: string; // 耗材明细
  sparePartReserve: number; // 备件风险准备金
  sparePartBasis: string; // 备件准备金测算依据
  // 报价
  cityPrice: number; // 城区报价
  faultHandlingFeeTotal: number; // 其中故障处理费
  coreMaintenanceContent: string; // 核心维保内容
}

// 维保报价计算结果
export interface MaintenanceQuoteResult {
  deviceItems: DeviceQuoteItemResult[];
  subtotal: number;
  taxAmount: number;
  total: number;
  totalByYear: {
    1: number;
    2: number;
    3: number;
  };
  totalByRegion: {
    [key in RegionType]: number;
  };
}

// 单设备报价结果
export interface DeviceQuoteItemResult {
  quota: DeviceQuota;
  quantity: number;
  depreciationLevel: DepreciationLevel;
  inWarranty: boolean;
  slaConfig: SLAConfig;
  // 各项费用
  inspectionFee: number;
  onSiteFee: number;
  faultHandlingFee: number;
  toolAmortization: number;
  consumableFee: number;
  sparePartReserve: number;
  // 合计
  cityPrice: number;
  totalBeforeDiscount: number;
  totalAfterDiscount: number;
}

// 计算维保报价
export function calculateMaintenanceQuote(
  deviceItems: Array<{
    quota: DeviceQuota;
    quantity: number;
    depreciationLevel: DepreciationLevel;
    inWarranty: boolean;
  }>,
  slaConfig: SLAConfig = DEFAULT_SLA_CONFIG,
  contractYears: number = 1,
  region: RegionType = '城区'
): MaintenanceQuoteResult {
  const taxRate = 0.13;
  const slaTotalFactor = calculateSLATotalFactor(slaConfig);
  const regionFactor = REGION_FACTORS[region];
  const yearDiscountFactor = MULTI_YEAR_DISCOUNTS[contractYears as keyof typeof MULTI_YEAR_DISCOUNTS] || 1.0;

  let subtotal = 0;
  const deviceResults: DeviceQuoteItemResult[] = [];

  // 计算每个设备的报价
  deviceItems.forEach((item) => {
    const quota = item.quota;
    const depreciationFactor = DEPRECIATION_FACTORS[item.depreciationLevel];
    const inWarrantyFactor = item.inWarranty ? 0.5 : 1.0;

    // 计算各项费用
    const inspectionFee = quota.inspectionLaborFee * slaTotalFactor;
    const onSiteFee = (quota.trafficFee + quota.onSiteConnectionLaborFee) * slaTotalFactor;
    
    // 故障处理费计算
    const levelConfig = MAINTENANCE_LEVEL_CONFIG[quota.level];
    const faultServiceCount = levelConfig.baseFaultCount * depreciationFactor;
    const faultHandlingFee = quota.faultHandlingFeeTotal * inWarrantyFactor * slaTotalFactor;

    const toolAmortization = quota.toolAmortization;
    const consumableFee = quota.consumableFee;
    const sparePartReserve = quota.sparePartReserve;

    // 城区报价
    const cityPrice = quota.cityPrice * slaTotalFactor;

    // 单设备合计（不含折扣）
    const totalBeforeDiscount = cityPrice * item.quantity;

    // 批量折扣
    const bulkDiscountFactor = item.quantity >= BULK_DISCOUNT_THRESHOLD ? BULK_DISCOUNT_FACTOR : 1.0;
    const totalAfterDiscount = totalBeforeDiscount * bulkDiscountFactor;

    subtotal += totalAfterDiscount;

    deviceResults.push({
      quota,
      quantity: item.quantity,
      depreciationLevel: item.depreciationLevel,
      inWarranty: item.inWarranty,
      slaConfig,
      inspectionFee,
      onSiteFee,
      faultHandlingFee,
      toolAmortization,
      consumableFee,
      sparePartReserve,
      cityPrice,
      totalBeforeDiscount,
      totalAfterDiscount,
    });
  });

  // 计算税费和总价
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // 计算多年期总价
  const totalByYear = {
    1: total,
    2: total * MULTI_YEAR_DISCOUNTS[2],
    3: total * MULTI_YEAR_DISCOUNTS[3],
  };

  // 计算不同地区的总价
  const totalByRegion = {
    '城区': total * REGION_FACTORS['城区'],
    '市区县城郊区': total * REGION_FACTORS['市区县城郊区'],
    '乡镇': total * REGION_FACTORS['乡镇'],
    '农村': total * REGION_FACTORS['农村'],
  };

  return {
    deviceItems: deviceResults,
    subtotal,
    taxAmount,
    total,
    totalByYear,
    totalByRegion,
  };
}
