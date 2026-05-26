
import type { FullDeviceQuota, SLAConfig, DepreciationLevel, RegionType } from './device-quota-full';
import { 
  FULL_MAINTENANCE_LEVEL_CONFIG,
  ENGINEER_PRICES,
  DEPRECIATION_FACTORS,
  SERVICE_TIME_FACTORS,
  REGION_FACTORS,
  DEFAULT_SLA_CONFIG,
  BULK_DISCOUNT_THRESHOLD,
  BULK_DISCOUNT_FACTOR,
  MULTI_YEAR_DISCOUNTS,
  calculateSLATotalFactor
} from './device-quota-full';

// 单设备报价结果（完整）
export interface FullDeviceQuoteItemResult {
  quota: FullDeviceQuota;
  quantity: number;
  depreciationLevel: DepreciationLevel;
  inWarranty: boolean;
  slaConfig: SLAConfig;
  slaTotalFactor: number;
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
  inWarranty: boolean,
  slaConfig: SLAConfig = DEFAULT_SLA_CONFIG
): FullDeviceQuoteItemResult {
  const slaTotalFactor = calculateSLATotalFactor(slaConfig);
  const depreciationFactor = DEPRECIATION_FACTORS[depreciationLevel];
  const inWarrantyFactor = inWarranty ? 0.5 : 1.0;
  
  const inspectionFee = quota.inspectionFeeAnnual * slaTotalFactor;
  const onSiteFee = quota.onSiteFeeAnnual * slaTotalFactor;
  const faultHandlingFee = quota.faultHandlingFeeTotal * inWarrantyFactor * slaTotalFactor;
  const toolAmortization = quota.toolAmortization;
  const consumableFee = quota.consumableFee;
  const sparePartReserve = quota.sparePartReserve;
  
  const subtotalBeforeSLA = 
    quota.inspectionFeeAnnual + 
    quota.onSiteFeeAnnual + 
    quota.faultHandlingFeeTotal + 
    quota.toolAmortization + 
    quota.consumableFee + 
    quota.sparePartReserve;
  
  const subtotalAfterSLA = 
    inspectionFee + 
    onSiteFee + 
    faultHandlingFee + 
    toolAmortization + 
    consumableFee + 
    sparePartReserve;
  
  const cityPrice = quota.cityPrice * slaTotalFactor;
  const urbanPrice = quota.urbanPrice * slaTotalFactor;
  const townPrice = quota.townPrice * slaTotalFactor;
  const ruralPrice = quota.ruralPrice * slaTotalFactor;
  
  const bulkDiscountFactor = quantity >= BULK_DISCOUNT_THRESHOLD ? BULK_DISCOUNT_FACTOR : 1.0;
  const totalBeforeDiscount = cityPrice * quantity;
  const totalAfterDiscount = totalBeforeDiscount * bulkDiscountFactor;
  
  return {
    quota,
    quantity,
    depreciationLevel,
    inWarranty,
    slaConfig,
    slaTotalFactor,
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
    inWarranty: boolean;
  }>,
  slaConfig: SLAConfig = DEFAULT_SLA_CONFIG,
  contractYears: number = 1,
  primaryRegion: RegionType = '城区'
): FullMaintenanceQuoteResult {
  const taxRate = 0.13;
  
  const deviceResults = deviceItems.map(item => 
    calculateFullDeviceQuote(
      item.quota,
      item.quantity,
      item.depreciationLevel,
      item.inWarranty,
      slaConfig
    )
  );
  
  const totalDevices = deviceResults.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalBeforeDiscount = deviceResults.reduce((sum, item) => sum + item.totalBeforeDiscount, 0);
  const subtotalAfterDiscount = deviceResults.reduce((sum, item) => sum + item.totalAfterDiscount, 0);
  const bulkDiscountAmount = subtotalBeforeDiscount - subtotalAfterDiscount;
  
  const yearDiscountFactor1 = MULTI_YEAR_DISCOUNTS[1];
  const yearDiscountFactor2 = MULTI_YEAR_DISCOUNTS[2];
  const yearDiscountFactor3 = MULTI_YEAR_DISCOUNTS[3];
  
  const subtotalAfterYearDiscount1 = subtotalAfterDiscount * yearDiscountFactor1;
  const subtotalAfterYearDiscount2 = subtotalAfterDiscount * yearDiscountFactor2 * 2;
  const subtotalAfterYearDiscount3 = subtotalAfterDiscount * yearDiscountFactor3 * 3;
  
  const taxAmount1 = subtotalAfterYearDiscount1 * taxRate;
  const taxAmount2 = subtotalAfterYearDiscount2 * taxRate;
  const taxAmount3 = subtotalAfterYearDiscount3 * taxRate;
  
  const calculateRegionTotal = (regionFactor: number) => {
    const subtotal = subtotalAfterDiscount * regionFactor;
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
      1: subtotalAfterYearDiscount1 + taxAmount1,
      2: subtotalAfterYearDiscount2 + taxAmount2,
      3: subtotalAfterYearDiscount3 + taxAmount3,
    },
    totalByRegion: {
      '城区': calculateRegionTotal(REGION_FACTORS['城区']),
      '市区县城郊区': calculateRegionTotal(REGION_FACTORS['市区县城郊区']),
      '乡镇': calculateRegionTotal(REGION_FACTORS['乡镇']),
      '农村': calculateRegionTotal(REGION_FACTORS['农村']),
    },
    taxRate,
    taxAmount: subtotalAfterDiscount * taxRate,
    finalTotal: subtotalAfterDiscount * (1 + taxRate),
  };
}

export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

export function formatCurrencyDisplay(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

