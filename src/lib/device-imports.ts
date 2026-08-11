/**
 * 设备清单导入相关类型定义。
 *
 * 数据持久化已迁移到 device_imports 表（见 src/lib/device-import-store.ts），
 * 本文件仅保留类型，供前端页面与 API 共享。
 */

import type { FullDeviceQuota, MaintenanceLevel, EngineerLevel, DepreciationLevel } from './device-quota-full';
import type { DeviceGrade, DepreciationGrade } from './device-grade';

export type { MaintenanceLevel, EngineerLevel, DepreciationLevel };

// 设备清单导入审核状态
export type ImportStatus = 'pending' | 'approved' | 'rejected';

// 完整的设备清单导入数据结构（包含 Excel 的全部字段）
export interface DeviceImportItem extends Partial<FullDeviceQuota> {
  id: string;
  // 基础信息（必填）
  category: string; // 设备分类
  name: string; // 设备名称
  model: string; // 规格/型号
  level: MaintenanceLevel; // 维保分档
  engineerLevel: EngineerLevel; // 进场工程师等级
  deviceCount: number; // 设备数量
  needSparePart: boolean; // 是否需要备件

  // 运维团队经验系数
  teamExperienceWithFactor?: number;
  teamExperienceSimilarFactor?: number;
  teamExperienceWithoutFactor?: number;

  // 安全等级系数
  securityLevel1Factor?: number;
  securityLevel2Factor?: number;
  securityLevel3Factor?: number;
  securityLevel4Factor?: number;
  securityLevel5Factor?: number;

  // 支持方式系数
  supportModeOffsiteFactor?: number;
  supportModeOnsiteFactor?: number;
  supportModePureOnsiteFactor?: number;

  // 故障恢复时间系数
  faultRecoveryTime4hFactor?: number;
  faultRecoveryTime24hFactor?: number;
  faultRecoveryTime48hFactor?: number;
  faultRecoveryTime72hFactor?: number;

  // 到场时间系数
  arrivalTime2hFactor?: number;
  arrivalTime8hFactor?: number;

  // 响应时间系数
  responseTime10minFactor?: number;
  responseTime30minFactor?: number;

  // 服务时间系数
  serviceTime5x8Factor?: number;
  serviceTime7x8Factor?: number;
  serviceTime7x24Factor?: number;

  // SLA 总系数
  slaTotalFactor?: number;

  // 巡检费相关
  inspectionLaborFee?: number;
  inspectionPersonCount?: number;
  inspectionDuration?: number;
  inspectionTimesPerYear?: number;
  inspectionContent?: string;

  // 上门费相关
  onSiteFeeAnnual?: number;
  trafficFee?: number;
  singleTripDuration?: number;
  connectionDuration?: number;
  onSiteConnectionLaborFee?: number;

  // 故障处理费相关
  faultHandlingFeeTotal?: number;
  inWarrantyFactor?: number;
  depreciationLevelDescription?: DepreciationLevel;
  deviceGrade?: DeviceGrade; // 设备分档：A/B/C/D/E
  depreciationGrade?: DepreciationGrade; // 成新率等级：1-5 级
  baseFaultCount?: number;
  depreciationFactor?: number;
  faultServiceCount?: number;
  faultHandlerCount?: number;
  faultHandlingDuration?: number;

  // 工具仪表与耗材
  toolAmortization?: number;
  toolDetails?: string;
  consumableFee?: number;
  consumableDetails?: string;

  // 备件相关
  sparePartReserve?: number;
  sparePartBasis?: string;

  // 报价相关
  cityPrice?: number;
  faultHandlingFeeDetail?: number;
  bulkDiscountNote?: string;
  serviceTimeNote?: string;

  // 多年期总价
  year1TotalPrice?: number;
  year2TotalPrice?: number;
  year3TotalPrice?: number;

  // 其他地区总价
  urbanPrice?: number;
  townPrice?: number;
  ruralPrice?: number;

  // 维保内容
  coreMaintenanceContent?: string;

  // 合同年限（自定义字段）
  contractYears: number;

  // 审核相关
  submittedBy: string;
  submittedAt: Date;
  status: ImportStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComment?: string;
}
