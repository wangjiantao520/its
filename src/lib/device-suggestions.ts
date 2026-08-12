/**
 * 未入库设备补录请求相关类型定义。
 *
 * 报价时遇到设备库中没有的设备，报价员提交补录请求（device_suggestions 表），
 * 管理员审核批准后写入 device_quotas。本文件为前端页面与 API 共享的类型。
 */

export type SuggestionSource = 'engineering' | 'maintenance';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

// 设备补录请求（一条 = 一个设备）
export interface DeviceSuggestionItem {
  id: string;
  source: SuggestionSource;
  quoteId: string;
  quoteNumber: string;
  projectName: string;
  category: string;
  name: string;
  brand: string;
  model: string;
  specification: string;
  maintenanceTier: string;
  level: string;
  engineerLevel: string;
  tempUnitPrice: number;
  quantity: number;
  location: string;
  comment: string;
  status: SuggestionStatus;
  submittedBy: string;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComment?: string;
}

// 审批时填写的价格体系（映射 device_quotas 列）
export interface DeviceSuggestionPriceData {
  category: string;
  name: string;
  brand: string;
  model: string;
  specification: string;
  maintenanceTier: string;
  level: string;
  engineerLevel: string;
  annualFaultCount: number;
  aGearFaultCount: number;
  bGearFaultCount: number;
  cGearFaultCount: number;
  dGearFaultCount: number;
  eGearFaultCount: number;
  faultProcessingDays: number;
  inspectionDays: number;
  onSiteCount: number;
  inspectionLaborFee: number;
  visitServiceFee: number;
  trafficFee: number;
  faultHandlingFee: number;
  toolAmortization: number;
  consumableFee: number;
  sparePartReserve: number;
  sparePartFee: number;
}
