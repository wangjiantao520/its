
import type { FullDeviceQuota, SLAConfig, DepreciationLevel, RegionType } from './device-quota-full';
import type { DeviceGrade, DepreciationGrade } from './device-grade';

// 地区类型（用于优化后的计算）
export type Region = RegionType;

// 费用明细项
export interface CostDetailItem {
  name: string;
  amount: number;
  description: string;
}

// 设备报价项（用于页面展示）
export interface DeviceQuoteItem {
  quota: FullDeviceQuota;
  quantity: number;
  useYears: number;
  depreciationGrade: string;
  depreciationLevel: DepreciationLevel;
  deviceGrade: DeviceGrade;
  failureRate: number;
  expectedFailures: number;
  inWarranty: boolean;
  needSparePart: boolean;
}

// 完整报价结果（用于页面展示）
export interface FullQuoteResult {
  deviceItems: DeviceQuoteItem[];
  costDetails: CostDetailItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  totalByRegion: {
    [key in RegionType]: {
      subtotal: number;
      taxAmount: number;
      total: number;
    };
  };
}
import { 
  FULL_MAINTENANCE_LEVEL_CONFIG,
  ENGINEER_PRICES,
  DEPRECIATION_FACTORS,
  SERVICE_TIME_FACTORS,
  ARRIVAL_TIME_FACTORS,
  RESPONSE_TIME_FACTORS,
  REGION_FACTORS,
  DEFAULT_SLA_CONFIG,
  BULK_DISCOUNT_THRESHOLD,
  BULK_DISCOUNT_FACTOR,
  MULTI_YEAR_DISCOUNTS,
  calculateSLATotalFactor
} from './device-quota-full';
import { getDepreciationFactor } from './device-grade';

// 单设备报价结果（完整）
export interface FullDeviceQuoteItemResult {
  quota: FullDeviceQuota;
  quantity: number;
  depreciationLevel: DepreciationLevel;
  deviceGrade: DeviceGrade;
  depreciationGrade: DepreciationGrade;
  inWarranty: boolean;
  needSparePart: boolean;
  contractYears: number;
  slaConfig: SLAConfig;
  slaTotalFactor: number;
  yearDiscountFactor: number;
  inspectionDuration: number;
  inspectionFee: number;
  onSiteFee: number;
  faultHandlingFee: number;
  toolAmortization: number;
  consumableFee: number;
  sparePartReserve: number;
  subtotalBeforeSLA: number;
  subtotalAfterSLA: number;
  cityPrice: number;
  urbanPrice: number;
  townPrice: number;
  ruralPrice: number;
  bulkDiscountFactor: number;
  totalBeforeDiscount: number;
  totalAfterDiscount: number;
}

// 维保报价计算结果（完整）
export interface FullMaintenanceQuoteResult {
  deviceItems: FullDeviceQuoteItemResult[];
  totalDevices: number;
  subtotalBeforeDiscount: number;
  subtotalAfterDiscount: number;
  bulkDiscountAmount: number;
  totalByYear: {
    1: number;
    2: number;
    3: number;
  };
  totalByRegion: {
    [key in RegionType]: {
      subtotal: number;
      taxAmount: number;
      total: number;
    };
  };
  taxRate: number;
  taxAmount: number;
  finalTotal: number;
}

export function calculateFullDeviceQuote(
  quota: FullDeviceQuota,
  quantity: number,
  depreciationLevel: DepreciationLevel,
  deviceGrade: DeviceGrade,
  depreciationGrade: DepreciationGrade,
  inWarranty: boolean,
  needSparePart: boolean,
  contractYears: number = 1,
  slaConfig: SLAConfig = DEFAULT_SLA_CONFIG,
  customInWarrantyFactor?: number
): FullDeviceQuoteItemResult {
  const slaTotalFactor = calculateSLATotalFactor(slaConfig);
  const depreciationFactor = getDepreciationFactor(deviceGrade, depreciationGrade);
  const inWarrantyFactor = customInWarrantyFactor !== undefined 
    ? (inWarranty ? customInWarrantyFactor : 1.0) 
    : (inWarranty ? 0.5 : 1.0);
  const yearDiscountFactor = MULTI_YEAR_DISCOUNTS[contractYears as keyof typeof MULTI_YEAR_DISCOUNTS] || MULTI_YEAR_DISCOUNTS[1];
  
  // Excel公式：=IF(G4="否",AE4+AJ4+AO4+AW4+AY4,AE4+AJ4+AO4+AW4+AD+BA4)*F4
  // AE=巡检人工费, AJ=上门费, AO=故障处理费, AW=工具摊销, AY=耗材费, AD=其他, BA=备件准备金
  // G4="否" 表示不需要备件，G4其他值表示需要备件
  
  const inspectionFee = quota.inspectionLaborFee;
  const onSiteFee = quota.onSiteFeeAnnual;
  const faultHandlingFee = quota.faultHandlingFeeTotal;
  const toolAmortization = quota.toolAmortization;
  const consumableFee = quota.consumableFee;
  const sparePartReserve = quota.sparePartReserve;
  
  // 按照Excel公式明确计算基础价格
  // 如果不需要备件（needSparePart=false）：AE + AJ + AO + AW + AY
  // 如果需要备件（needSparePart=true）：AE + AJ + AO + AW + AD + BA
  // 验证：台式品牌电脑数据（不需要备件）：
  // inspectionLaborFee(33.67) + onSiteFeeAnnual(56.32) + faultHandlingFeeTotal(75.75) + toolAmortization(2.04) + consumableFee(5) = 172.7766666666667
  // 正好等于 cityPrice = 172.776666666667
  
  let baseCityPrice: number;
  if (needSparePart) {
    // 需要备件：使用完整的 cityPrice（包含备件风险准备金）
    baseCityPrice = quota.cityPrice;
  } else {
    // 不需要备件：从 cityPrice 中减去备件风险准备金
    baseCityPrice = quota.cityPrice - sparePartReserve;
  }
  
  // 使用Excel中已经预计算好的价格，并乘以SLA系数、折旧系数和是否在保系数
  const cityPrice = baseCityPrice * slaTotalFactor * depreciationFactor * inWarrantyFactor;
  // 所有地区价格都从城区价格出发，只通过REGION_FACTORS调整，避免乘两次两倍
  const urbanPrice = cityPrice * REGION_FACTORS['市区县城郊区'];
  const townPrice = cityPrice * REGION_FACTORS['乡镇'];
  const ruralPrice = cityPrice * REGION_FACTORS['农村'];
  
  const subtotalBeforeSLA = baseCityPrice;
  const subtotalAfterSLA = cityPrice;
  
  const bulkDiscountFactor = quantity >= BULK_DISCOUNT_THRESHOLD ? BULK_DISCOUNT_FACTOR : 1.0;
  const totalBeforeDiscount = cityPrice * quantity;
  const totalAfterBulkDiscount = totalBeforeDiscount * bulkDiscountFactor;
  const totalAfterDiscount = totalAfterBulkDiscount * yearDiscountFactor * contractYears;
  
  return {
    quota,
    quantity,
    depreciationLevel,
    deviceGrade,
    depreciationGrade,
    inWarranty,
    needSparePart,
    contractYears,
    slaConfig,
    slaTotalFactor,
    yearDiscountFactor,
    inspectionDuration: quota.inspectionDuration,
    inspectionFee,
    onSiteFee,
    faultHandlingFee,
    toolAmortization,
    consumableFee,
    sparePartReserve,
    subtotalBeforeSLA,
    subtotalAfterSLA,
    cityPrice,
    urbanPrice,
    townPrice,
    ruralPrice,
    bulkDiscountFactor,
    totalBeforeDiscount,
    totalAfterDiscount,
  };
}

export function calculateFullMaintenanceQuote(
  deviceItems: Array<{
    quota: FullDeviceQuota;
    quantity: number;
    depreciationLevel: DepreciationLevel;
    deviceGrade: DeviceGrade;
    depreciationGrade: DepreciationGrade;
    inWarranty: boolean;
    needSparePart: boolean;
    contractYears: number;
  }>,
  slaConfig: SLAConfig = DEFAULT_SLA_CONFIG,
  primaryRegion: RegionType = '城区'
): FullMaintenanceQuoteResult {
  const taxRate = 0.13;
  
  const deviceResults = deviceItems.map(item => 
    calculateFullDeviceQuote(
      item.quota,
      item.quantity,
      item.depreciationLevel,
      item.deviceGrade,
      item.depreciationGrade,
      item.inWarranty,
      item.needSparePart,
      item.contractYears,
      slaConfig
    )
  );
  
  const totalDevices = deviceResults.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalBeforeDiscount = deviceResults.reduce((sum, item) => sum + item.totalBeforeDiscount, 0);
  const subtotalAfterDiscount = deviceResults.reduce((sum, item) => sum + item.totalAfterDiscount, 0);
  const bulkDiscountAmount = subtotalBeforeDiscount - (subtotalAfterDiscount / deviceResults.reduce((sum, item) => sum + (item.yearDiscountFactor * item.contractYears), 0));
  
  const calculateRegionTotal = (regionType: RegionType) => {
    const subtotal = deviceResults.reduce((sum, item) => {
      const regionPrice = 
        regionType === '城区' ? item.cityPrice :
        regionType === '市区县城郊区' ? item.urbanPrice :
        regionType === '乡镇' ? item.townPrice :
        item.ruralPrice;
      return sum + regionPrice * item.quantity * item.bulkDiscountFactor * item.yearDiscountFactor * item.contractYears;
    }, 0);
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };
  
  return {
    deviceItems: deviceResults,
    totalDevices,
    subtotalBeforeDiscount,
    subtotalAfterDiscount,
    bulkDiscountAmount,
    totalByYear: {
      1: 0,
      2: 0,
      3: 0,
    },
    totalByRegion: {
      '城区': calculateRegionTotal('城区'),
      '市区县城郊区': calculateRegionTotal('市区县城郊区'),
      '乡镇': calculateRegionTotal('乡镇'),
      '农村': calculateRegionTotal('农村'),
    },
    taxRate,
    taxAmount: subtotalAfterDiscount * taxRate,
    finalTotal: subtotalAfterDiscount * (1 + taxRate),
  };
}

export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

// 根据设备使用年限自动推荐成新率
export function getRecommendedDepreciationGrade(useYears: number): string {
  if (useYears <= 1) {
    return '1';
  } else if (useYears <= 3) {
    return '2';
  } else if (useYears <= 6) {
    return '3';
  } else if (useYears <= 8) {
    return '4';
  } else {
    return '5';
  }
}

// 根据设备使用年限和成新率获取故障率
export function getFailureRate(useYears: number, depreciationGrade: string | number): number {
  // 转换为字符串进行比较，确保数字 1 也能正确匹配
  const grade = String(depreciationGrade);

  switch (grade) {
    case '1':
      return 0.01;
    case '2':
      return 0.05;
    case '3':
      return 0.07;
    default:
      // 4, 5, 或其他值都返回默认的 12%
      return 0.12;
  }
}

export function formatCurrencyDisplay(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

