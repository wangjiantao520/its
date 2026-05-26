
// 完整的设备定额数据结构（包含Excel的65列）
export type MaintenanceLevel = 'A' | 'B' | 'C' | 'D' | 'E';

export type EngineerLevel = '初级' | '中级' | '高级';

export type DepreciationLevel = '全新' | '较新' | '一般' | '偏旧' | '老旧';

export type ServiceTimeType = '5×8' | '7×8' | '7×24';

export type RegionType = '城区' | '市区县城郊区' | '乡镇' | '农村';

// 完整的设备定额数据结构（基于Excel的65列）
export interface FullDeviceQuota {
  // ===== 基础信息 =====
  id: string;
  serialNumber: number; // 序号
  category: string; // 设备分类
  subCategory?: string; // 设备子分类
  name: string; // 设备名称
  brand?: string; // 品牌
  model: string; // 规格/型号
  specification?: string; // 技术参数/规格说明
  unit: string; // 单位（台/套/个等）
  
  // ===== 维保分档 =====
  level: MaintenanceLevel; // 维保分档（A-E）
  levelName: string; // 维保分档名称
  engineerLevel: EngineerLevel; // 工程师等级
  levelDescription?: string; // 维保分档说明
  
  // ===== 巡检费相关 =====
  inspectionLaborFee: number; // 巡检人工费（元）
  inspectionPersonCount: number; // 巡检人数
  inspectionDuration: number; // 巡检时长（分钟）
  inspectionTimesPerYear: number; // 年基础服务次数
  inspectionContent: string; // 巡检内容
  inspectionFeeAnnual: number; // 年巡检费小计
  
  // ===== 上门费相关 =====
  trafficFee: number; // 交通费（来回，元）
  singleTripDuration: number; // 单趟上门时长（分钟）
  connectionDuration: number; // 上门后衔接时长（分钟）
  onSiteConnectionLaborFee: number; // 上门衔接工时费（元）
  onSiteFeeAnnual: number; // 年上门费小计
  
  // ===== 故障处理费相关 =====
  inWarrantyFactor: number; // 是否在保系数（0.5/1.0）
  baseFaultCount: number; // 年故障数基准值
  depreciationFactor: number; // 成新率系数
  faultServiceCount: number; // 故障服务次数
  faultHandlerCount: number; // 故障受理人数
  faultHandlingDuration: number; // 故障受理时长（分钟）
  faultHandlingLaborFee: number; // 故障处理工时费（元）
  faultHandlingFeeTotal: number; // 故障处理费合计（元）
  
  // ===== 工具仪表相关 =====
  toolAmortization: number; // 工具仪表摊销（元）
  toolDetails: string; // 维保涉及工具仪表明细
  
  // ===== 耗材相关 =====
  consumableFee: number; // 耗材费（元）
  consumableDetails: string; // 耗材明细
  
  // ===== 备件相关 =====
  sparePartReserve: number; // 备件风险准备金（元）
  sparePartBasis: string; // 备件准备金测算依据
  
  // ===== 维保内容 =====
  coreMaintenanceContent: string; // 核心维保内容
  maintenanceScope?: string; // 维保范围说明
  specialRequirements?: string; // 特殊要求
  
  // ===== 报价相关（4个地区） =====
  cityPrice: number; // 城区报价（元）
  urbanPrice: number; // 市区县城郊区报价（元）
  townPrice: number; // 乡镇报价（元）
  ruralPrice: number; // 农村报价（元）
  
  // ===== 费用明细分解 =====
  inspectionFeeDetail: number; // 巡检费明细
  onSiteFeeDetail: number; // 上门费明细
  faultHandlingFeeDetail: number; // 故障处理费明细
  toolFeeDetail: number; // 工具费明细
  consumableFeeDetail: number; // 耗材费明细
  sparePartFeeDetail: number; // 备件费明细
  
  // ===== 其他字段 =====
  remarks?: string; // 备注
  isActive?: boolean; // 是否启用
  lastUpdated?: string; // 最后更新时间
  dataSource?: string; // 数据来源
}

// 维保档次配置（完整）
export const FULL_MAINTENANCE_LEVEL_CONFIG = {
  A: { 
    name: '简易型', 
    baseFaultCount: 1.0, 
    description: '结构简单、即插即用、维护难度低',
    faultCountMultiplier: 1.0,
    complexityFactor: 0.8
  },
  B: { 
    name: '基础型', 
    baseFaultCount: 2.0, 
    description: '标准办公通用设备、维护难度适中',
    faultCountMultiplier: 1.0,
    complexityFactor: 1.0
  },
  C: { 
    name: '中级型', 
    baseFaultCount: 2.4, 
    description: '结构较复杂、需要一定专业技能',
    faultCountMultiplier: 1.2,
    complexityFactor: 1.2
  },
  D: { 
    name: '高级型', 
    baseFaultCount: 1.8, 
    description: '集成精密机电、维护要求较高',
    faultCountMultiplier: 1.5,
    complexityFactor: 1.5
  },
  E: { 
    name: '专家型', 
    baseFaultCount: 1.2, 
    description: '大型精密设备、需要专业工程师',
    faultCountMultiplier: 2.0,
    complexityFactor: 2.0
  },
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

// 服务时间系数
export const SERVICE_TIME_FACTORS = {
  '5×8': 1.0,
  '7×8': 1.2,
  '7×24': 1.6,
};

// 地区系数
export const REGION_FACTORS = {
  '城区': 1.0,
  '市区县城郊区': 1.1,
  '乡镇': 1.5,
  '农村': 2.0,
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
  const serviceTimeFactor = SERVICE_TIME_FACTORS[config.serviceTime];
  return config.teamExperience * config.securityLevel * config.supportMode * 
         config.faultRecoveryTime * config.arrivalTime * config.responseTime * serviceTimeFactor;
}

// 批量折扣（≥50台）
export const BULK_DISCOUNT_THRESHOLD = 50;
export const BULK_DISCOUNT_FACTOR = 0.9;

// 多年期折扣
export const MULTI_YEAR_DISCOUNTS = {
  1: 1.0,
  2: 0.95,
  3: 0.9,
};

