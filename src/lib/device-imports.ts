/**
 * 设备清单导入相关类型与操作
 *
 * 从 roles.ts 拆分，roles.ts 仅保留用户/角色类型。
 * 设备导入数据当前仍为内存态存储（沿用历史行为），
 * TODO: 后续可迁移到 device_imports 表持久化，避免服务重启丢失。
 */

import type { FullDeviceQuota, MaintenanceLevel, EngineerLevel, DepreciationLevel } from './device-quota-full';
import type { DeviceGrade, DepreciationGrade } from './device-grade';
import { addDeviceToQuota } from './complete-device-data';

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

// 内存态存储：服务重启会丢失，沿用历史行为
// eslint-disable-next-line prefer-const
let deviceImports: DeviceImportItem[] = [];

export function getDeviceImports(): DeviceImportItem[] {
  return deviceImports;
}

export function addDeviceImport(
  item: Omit<DeviceImportItem, 'id' | 'submittedAt' | 'status'>
): DeviceImportItem {
  const newItem: DeviceImportItem = {
    ...item,
    id: Date.now().toString(),
    submittedAt: new Date(),
    status: 'pending',
  } as DeviceImportItem;
  deviceImports.push(newItem);
  return newItem;
}

/**
 * 仅保留值不为 undefined 的字段，用于把 DeviceImportItem 的可选字段
 * 安全合并到 addDeviceToQuota 的入参，替代 60+ 行 `...(x !== undefined && {x})` 重复。
 */
function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function updateDeviceImportStatus(
  id: string,
  status: ImportStatus,
  reviewedBy: string,
  reviewComment?: string
): DeviceImportItem | null {
  const index = deviceImports.findIndex(item => item.id === id);
  if (index === -1) return null;

  deviceImports[index] = {
    ...deviceImports[index],
    status,
    reviewedBy,
    reviewedAt: new Date(),
    reviewComment,
  };

  // 审核通过：将设备写入定额库
  if (status === 'approved') {
    const item = deviceImports[index];
    addDeviceToQuota({
      category: item.category,
      name: item.name,
      model: item.model,
      level: item.level,
      levelName: item.levelName || `${item.level}档`,
      engineerLevel: item.engineerLevel,
      ...pickDefined({
        deviceCount: item.deviceCount,
        needSparePart: item.needSparePart,
        teamExperienceWithFactor: item.teamExperienceWithFactor,
        teamExperienceSimilarFactor: item.teamExperienceSimilarFactor,
        teamExperienceWithoutFactor: item.teamExperienceWithoutFactor,
        securityLevel1Factor: item.securityLevel1Factor,
        securityLevel2Factor: item.securityLevel2Factor,
        securityLevel3Factor: item.securityLevel3Factor,
        securityLevel4Factor: item.securityLevel4Factor,
        securityLevel5Factor: item.securityLevel5Factor,
        supportModeOffsiteFactor: item.supportModeOffsiteFactor,
        supportModeOnsiteFactor: item.supportModeOnsiteFactor,
        supportModePureOnsiteFactor: item.supportModePureOnsiteFactor,
        faultRecoveryTime4hFactor: item.faultRecoveryTime4hFactor,
        faultRecoveryTime24hFactor: item.faultRecoveryTime24hFactor,
        faultRecoveryTime48hFactor: item.faultRecoveryTime48hFactor,
        faultRecoveryTime72hFactor: item.faultRecoveryTime72hFactor,
        arrivalTime2hFactor: item.arrivalTime2hFactor,
        arrivalTime8hFactor: item.arrivalTime8hFactor,
        responseTime10minFactor: item.responseTime10minFactor,
        responseTime30minFactor: item.responseTime30minFactor,
        serviceTime5x8Factor: item.serviceTime5x8Factor,
        serviceTime7x8Factor: item.serviceTime7x8Factor,
        serviceTime7x24Factor: item.serviceTime7x24Factor,
        slaTotalFactor: item.slaTotalFactor,
        inspectionLaborFee: item.inspectionLaborFee,
        inspectionPersonCount: item.inspectionPersonCount,
        inspectionDuration: item.inspectionDuration,
        inspectionTimesPerYear: item.inspectionTimesPerYear,
        inspectionContent: item.inspectionContent,
        onSiteFeeAnnual: item.onSiteFeeAnnual,
        trafficFee: item.trafficFee,
        singleTripDuration: item.singleTripDuration,
        connectionDuration: item.connectionDuration,
        onSiteConnectionLaborFee: item.onSiteConnectionLaborFee,
        faultHandlingFeeTotal: item.faultHandlingFeeTotal,
        inWarrantyFactor: item.inWarrantyFactor,
        depreciationLevelDescription: item.depreciationLevelDescription,
        baseFaultCount: item.baseFaultCount,
        depreciationFactor: item.depreciationFactor,
        faultServiceCount: item.faultServiceCount,
        faultHandlerCount: item.faultHandlerCount,
        faultHandlingDuration: item.faultHandlingDuration,
        toolAmortization: item.toolAmortization,
        toolDetails: item.toolDetails,
        consumableFee: item.consumableFee,
        consumableDetails: item.consumableDetails,
        sparePartReserve: item.sparePartReserve,
        sparePartBasis: item.sparePartBasis,
        cityPrice: item.cityPrice,
        faultHandlingFeeDetail: item.faultHandlingFeeDetail,
        bulkDiscountNote: item.bulkDiscountNote,
        serviceTimeNote: item.serviceTimeNote,
        year1TotalPrice: item.year1TotalPrice,
        year2TotalPrice: item.year2TotalPrice,
        year3TotalPrice: item.year3TotalPrice,
        urbanPrice: item.urbanPrice,
        townPrice: item.townPrice,
        ruralPrice: item.ruralPrice,
        coreMaintenanceContent: item.coreMaintenanceContent,
        unit: item.unit,
      }),
    });
  }

  return deviceImports[index];
}
