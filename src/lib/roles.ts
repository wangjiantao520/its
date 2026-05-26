import type { FullDeviceQuota, MaintenanceLevel, EngineerLevel, DepreciationLevel } from './device-quota-full';

export type { MaintenanceLevel, EngineerLevel, DepreciationLevel };

export type UserRole = 'its_member' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
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
    return deviceImports[index];
  }
  return null;
};
