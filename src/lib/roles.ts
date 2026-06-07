import type { FullDeviceQuota, MaintenanceLevel, EngineerLevel, DepreciationLevel } from './device-quota-full';
import type { DeviceGrade, DepreciationGrade } from './device-grade';
import { addDeviceToQuota } from './complete-device-data';

export type { MaintenanceLevel, EngineerLevel, DepreciationLevel };

export type UserRole = 'its_member' | 'admin';
export type Role = UserRole;
export const ROLE = {
  ITS_MEMBER: 'its_member' as Role,
  ADMIN: 'admin' as Role
};

export interface User {
  id: string;
  name: string;
  role: UserRole;
  username?: string;  // 登录用户名
}

// 模拟当前用户（实际应用中应该从后端或认证系统获取）
export const getCurrentUser = (): User => {
  // 这里先模拟一个用户，实际应用中应该从认证系统获取
  return {
    id: '1',
    name: '当前用户',
    role: 'its_member', // 默认是ITS成员
  };
};

// 切换角色（仅用于演示）
export const switchUserRole = (role: UserRole): User => {
  return {
    id: '1',
    name: role === 'its_member' ? 'ITS成员' : '管理员',
    role,
  };
};

// 设备清单导入状态
export type ImportStatus = 'pending' | 'approved' | 'rejected';

// 完整的设备清单导入数据结构（包含Excel的全部字段）
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
  
  // SLA总系数
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
  depreciationGrade?: DepreciationGrade; // 成新率等级：1-5级
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

// 模拟设备导入数据存储
let deviceImports: DeviceImportItem[] = [];

export const getDeviceImports = (): DeviceImportItem[] => {
  return deviceImports;
};

export const addDeviceImport = (item: Omit<DeviceImportItem, 'id' | 'submittedAt' | 'status'>): DeviceImportItem => {
  const newItem: DeviceImportItem = {
    ...item,
    id: Date.now().toString(),
    submittedAt: new Date(),
    status: 'pending',
  } as DeviceImportItem;
  deviceImports.push(newItem);
  return newItem;
};

export const updateDeviceImportStatus = (
  id: string,
  status: ImportStatus,
  reviewedBy: string,
  reviewComment?: string
): DeviceImportItem | null => {
  const index = deviceImports.findIndex(item => item.id === id);
  if (index !== -1) {
    deviceImports[index] = {
      ...deviceImports[index],
      status,
      reviewedBy,
      reviewedAt: new Date(),
      reviewComment,
    };
    
    // 如果审核通过，添加到设备定额库
    if (status === 'approved') {
      const item = deviceImports[index];
      addDeviceToQuota({
        category: item.category,
        name: item.name,
        model: item.model,
        level: item.level,
        levelName: item.levelName || `${item.level}档`,
        engineerLevel: item.engineerLevel,
        // 可选字段，有值就传
        ...(item.deviceCount !== undefined && { deviceCount: item.deviceCount }),
        ...(item.needSparePart !== undefined && { needSparePart: item.needSparePart }),
        ...(item.teamExperienceWithFactor !== undefined && { teamExperienceWithFactor: item.teamExperienceWithFactor }),
        ...(item.teamExperienceSimilarFactor !== undefined && { teamExperienceSimilarFactor: item.teamExperienceSimilarFactor }),
        ...(item.teamExperienceWithoutFactor !== undefined && { teamExperienceWithoutFactor: item.teamExperienceWithoutFactor }),
        ...(item.securityLevel1Factor !== undefined && { securityLevel1Factor: item.securityLevel1Factor }),
        ...(item.securityLevel2Factor !== undefined && { securityLevel2Factor: item.securityLevel2Factor }),
        ...(item.securityLevel3Factor !== undefined && { securityLevel3Factor: item.securityLevel3Factor }),
        ...(item.securityLevel4Factor !== undefined && { securityLevel4Factor: item.securityLevel4Factor }),
        ...(item.securityLevel5Factor !== undefined && { securityLevel5Factor: item.securityLevel5Factor }),
        ...(item.supportModeOffsiteFactor !== undefined && { supportModeOffsiteFactor: item.supportModeOffsiteFactor }),
        ...(item.supportModeOnsiteFactor !== undefined && { supportModeOnsiteFactor: item.supportModeOnsiteFactor }),
        ...(item.supportModePureOnsiteFactor !== undefined && { supportModePureOnsiteFactor: item.supportModePureOnsiteFactor }),
        ...(item.faultRecoveryTime4hFactor !== undefined && { faultRecoveryTime4hFactor: item.faultRecoveryTime4hFactor }),
        ...(item.faultRecoveryTime24hFactor !== undefined && { faultRecoveryTime24hFactor: item.faultRecoveryTime24hFactor }),
        ...(item.faultRecoveryTime48hFactor !== undefined && { faultRecoveryTime48hFactor: item.faultRecoveryTime48hFactor }),
        ...(item.faultRecoveryTime72hFactor !== undefined && { faultRecoveryTime72hFactor: item.faultRecoveryTime72hFactor }),
        ...(item.arrivalTime2hFactor !== undefined && { arrivalTime2hFactor: item.arrivalTime2hFactor }),
        ...(item.arrivalTime8hFactor !== undefined && { arrivalTime8hFactor: item.arrivalTime8hFactor }),
        ...(item.responseTime10minFactor !== undefined && { responseTime10minFactor: item.responseTime10minFactor }),
        ...(item.responseTime30minFactor !== undefined && { responseTime30minFactor: item.responseTime30minFactor }),
        ...(item.serviceTime5x8Factor !== undefined && { serviceTime5x8Factor: item.serviceTime5x8Factor }),
        ...(item.serviceTime7x8Factor !== undefined && { serviceTime7x8Factor: item.serviceTime7x8Factor }),
        ...(item.serviceTime7x24Factor !== undefined && { serviceTime7x24Factor: item.serviceTime7x24Factor }),
        ...(item.slaTotalFactor !== undefined && { slaTotalFactor: item.slaTotalFactor }),
        ...(item.inspectionLaborFee !== undefined && { inspectionLaborFee: item.inspectionLaborFee }),
        ...(item.inspectionPersonCount !== undefined && { inspectionPersonCount: item.inspectionPersonCount }),
        ...(item.inspectionDuration !== undefined && { inspectionDuration: item.inspectionDuration }),
        ...(item.inspectionTimesPerYear !== undefined && { inspectionTimesPerYear: item.inspectionTimesPerYear }),
        ...(item.inspectionContent !== undefined && { inspectionContent: item.inspectionContent }),
        ...(item.onSiteFeeAnnual !== undefined && { onSiteFeeAnnual: item.onSiteFeeAnnual }),
        ...(item.trafficFee !== undefined && { trafficFee: item.trafficFee }),
        ...(item.singleTripDuration !== undefined && { singleTripDuration: item.singleTripDuration }),
        ...(item.connectionDuration !== undefined && { connectionDuration: item.connectionDuration }),
        ...(item.onSiteConnectionLaborFee !== undefined && { onSiteConnectionLaborFee: item.onSiteConnectionLaborFee }),
        ...(item.faultHandlingFeeTotal !== undefined && { faultHandlingFeeTotal: item.faultHandlingFeeTotal }),
        ...(item.inWarrantyFactor !== undefined && { inWarrantyFactor: item.inWarrantyFactor }),
        ...(item.depreciationLevelDescription !== undefined && { depreciationLevelDescription: item.depreciationLevelDescription }),
        ...(item.baseFaultCount !== undefined && { baseFaultCount: item.baseFaultCount }),
        ...(item.depreciationFactor !== undefined && { depreciationFactor: item.depreciationFactor }),
        ...(item.faultServiceCount !== undefined && { faultServiceCount: item.faultServiceCount }),
        ...(item.faultHandlerCount !== undefined && { faultHandlerCount: item.faultHandlerCount }),
        ...(item.faultHandlingDuration !== undefined && { faultHandlingDuration: item.faultHandlingDuration }),
        ...(item.toolAmortization !== undefined && { toolAmortization: item.toolAmortization }),
        ...(item.toolDetails !== undefined && { toolDetails: item.toolDetails }),
        ...(item.consumableFee !== undefined && { consumableFee: item.consumableFee }),
        ...(item.consumableDetails !== undefined && { consumableDetails: item.consumableDetails }),
        ...(item.sparePartReserve !== undefined && { sparePartReserve: item.sparePartReserve }),
        ...(item.sparePartBasis !== undefined && { sparePartBasis: item.sparePartBasis }),
        ...(item.cityPrice !== undefined && { cityPrice: item.cityPrice }),
        ...(item.faultHandlingFeeDetail !== undefined && { faultHandlingFeeDetail: item.faultHandlingFeeDetail }),
        ...(item.bulkDiscountNote !== undefined && { bulkDiscountNote: item.bulkDiscountNote }),
        ...(item.serviceTimeNote !== undefined && { serviceTimeNote: item.serviceTimeNote }),
        ...(item.year1TotalPrice !== undefined && { year1TotalPrice: item.year1TotalPrice }),
        ...(item.year2TotalPrice !== undefined && { year2TotalPrice: item.year2TotalPrice }),
        ...(item.year3TotalPrice !== undefined && { year3TotalPrice: item.year3TotalPrice }),
        ...(item.urbanPrice !== undefined && { urbanPrice: item.urbanPrice }),
        ...(item.townPrice !== undefined && { townPrice: item.townPrice }),
        ...(item.ruralPrice !== undefined && { ruralPrice: item.ruralPrice }),
        ...(item.coreMaintenanceContent !== undefined && { coreMaintenanceContent: item.coreMaintenanceContent }),
        ...(item.unit !== undefined && { unit: item.unit }),
      });
    }
    
    return deviceImports[index];
  }
  return null;
};
