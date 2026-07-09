// 完整的设备定额数据结构（包含Excel的全部65列）
export type MaintenanceLevel = 'A' | 'B' | 'C' | 'D' | 'E';

export type EngineerLevel = '初级' | '中级' | '高级';

export type DepreciationLevel = '全新' | '较新' | '一般' | '偏旧' | '老旧';

export type ServiceTimeType = '5×8' | '7×8' | '7×24';

export type ArrivalTimeType = '2小时' | '8小时';

export type ResponseTimeType = '10分钟' | '30分钟';

export type RegionType = '城区' | '市区县城郊区' | '乡镇' | '农村';

// 完整的设备定额数据结构（基于Excel的全部65列）
export interface FullDeviceQuota {
  // ===== Excel索引0-4: 基础信息 =====
  id: string;
  serialNumber: number; // 序号（补充字段）
  category: string; // 索引0: 设备分类
  name: string; // 索引1: 设备名称
  model: string; // 索引2: 规格/型号
  level: MaintenanceLevel; // 索引3: 维保分档（简易型A档，基础型B档，中级型C档，高级型D档，专家型E档）
  levelName: string; // 维保分档名称（补充字段）
  levelDescription?: string; // 维保分档说明（兼容旧字段）
  engineerLevel: EngineerLevel; // 索引4: 进场工程师等级（初级404元/天；中级543元/天；高级700元/天）
  
  // ===== Excel索引5-6: 设备相关 =====
  deviceCount?: number; // 索引5: 设备数量
  needSparePart?: boolean; // 索引6: 是否需要备件
  
  // ===== Excel索引7-9: 运维团队经验系数 =====
  teamExperienceWithFactor?: number; // 索引7: 运维团队经验-有系数1.2
  teamExperienceSimilarFactor?: number; // 索引8: 运维团队经验-类似系数1
  teamExperienceWithoutFactor?: number; // 索引9: 运维团队经验-无系数0.8
  
  // ===== Excel索引10-14: 安全等级系数 =====
  securityLevel1Factor?: number; // 索引10: 安全等级-第一级系数0.9
  securityLevel2Factor?: number; // 索引11: 安全等级-第二级系数0.95
  securityLevel3Factor?: number; // 索引12: 安全等级-第三级系数1
  securityLevel4Factor?: number; // 索引13: 安全等级-第四级系数1.05
  securityLevel5Factor?: number; // 索引14: 安全等级-第五级系数1.1
  
  // ===== Excel索引15-17: 支持方式系数 =====
  supportModeOffsiteFactor?: number; // 索引15: 支持方式-非现场支持为主系数0.89
  supportModeOnsiteFactor?: number; // 索引16: 支持方式-现场支持为主系数1
  supportModePureOnsiteFactor?: number; // 索引17: 支持方式-纯现场支持系数1.1
  
  // ===== Excel索引18-21: 故障恢复时间系数 =====
  faultRecoveryTime4hFactor?: number; // 索引18: 故障恢复时间-≤4h系数1.2
  faultRecoveryTime24hFactor?: number; // 索引19: 故障恢复时间-≤24h系数1
  faultRecoveryTime48hFactor?: number; // 索引20: 故障恢复时间-≤48h系数0.9
  faultRecoveryTime72hFactor?: number; // 索引21: 故障恢复时间-≤72h系数0.85
  
  // ===== Excel索引22-23: 到场时间系数 =====
  arrivalTime2hFactor?: number; // 索引22: 到场时间-2小时系数1.2
  arrivalTime8hFactor?: number; // 索引23: 到场时间-8小时系数1
  
  // ===== Excel索引24-25: 响应时间系数 =====
  responseTime10minFactor?: number; // 索引24: 响应时间-10分钟系数1.1
  responseTime30minFactor?: number; // 索引25: 响应时间-30分钟系数1
  
  // ===== Excel索引26-28: 服务时间系数 =====
  serviceTime5x8Factor?: number; // 索引26: 服务时间5×8服务系数1
  serviceTime7x8Factor?: number; // 索引27: 服务时间-7×8服务系数1.2
  serviceTime7x24Factor?: number; // 索引28: 服务时间-7×24服务系数1.6
  
  // ===== Excel索引29: SLA总系数 =====
  slaTotalFactor?: number; // 索引29: SLA总系数
  
  // ===== Excel索引30-34: 巡检费相关 =====
  inspectionLaborFee: number; // 索引30: 巡检人工费
  inspectionPersonCount: number; // 索引31: 巡检人数
  inspectionDuration: number; // 索引32: 巡检时长（分钟）
  inspectionTimesPerYear: number; // 索引33: 年基础服务次数
  inspectionContent: string; // 索引34: 巡检内容
  inspectionFeeAnnual: number; // 年巡检费小计（兼容旧字段）
  
  // ===== Excel索引35-39: 上门费相关 =====
  onSiteFeeAnnual: number; // 索引35: 故障上门服务费（等于交费通+上门衔接工时费乘以服务次数）
  trafficFee: number; // 索引36: 交通费（来回\元）
  singleTripDuration: number; // 索引37: 单趟上门时长（分钟）
  connectionDuration: number; // 索引38: 上门后衔接时长（分钟）
  onSiteConnectionLaborFee: number; // 索引39: 上门衔接工时费（元）（等于上门时长+衔接时长的和乘于相应档的工时费）
  
  // ===== Excel索引40-47: 故障处理费相关 =====
  faultHandlingFeeTotal: number; // 索引40: 故障处理费
  faultHandlingLaborFee: number; // 故障处理工时费（兼容旧字段）
  inWarrantyFactor: number; // 索引41: 是否在保系数（在原厂保0.5；过保1;在保则只是协助处理）
  depreciationLevelDescription?: string; // 索引42: 成新率(全新0–1年、较新1–3年、一般3–5年、偏旧5–8年及老旧8年以上)
  baseFaultCount: number; // 索引43: 年故障数-基准值（A档1，B档2，C档2.4，D档1.8，E档0.8）
  depreciationFactor: number; // 索引44: 成新率系数（全新0.6,较新0.8，一般1，偏旧1.3,老旧1.6）
  faultServiceCount: number; // 索引45: 故障服务次数(年故障数基准值*成新率系数)
  faultHandlerCount: number; // 索引46: 故障受理人数
  faultHandlingDuration: number; // 索引47: 故障受理时长(分钟)
  
  // ===== Excel索引48-51: 工具仪表与耗材 =====
  toolAmortization: number; // 索引48: 工具仪表摊销（元）
  toolDetails: string; // 索引49: 维保涉及工具仪表明细
  consumableFee: number; // 索引50: 耗材费
  consumableDetails: string; // 索引51: 维护中涉及到的基础、简单耗材及小配件等
  
  // ===== Excel索引52-53: 备件相关 =====
  sparePartReserve: number; // 索引52: 备件风险准备金（元）
  sparePartBasis: string; // 索引53: 备件准备金测算依据
  
  // ===== Excel索引54-57: 报价相关 =====
  cityPrice: number; // 索引54: 城区报价(元·年)
  faultHandlingFeeDetail: number; // 索引55: 其中故障处理费(元·年)
  bulkDiscountNote?: string; // 索引56: 批量让利≥50台9折，也可以再考虑大于100台，大于200台等同类设备的进行阶段让利
  serviceTimeNote?: string; // 索引57: 7×8服务系数1.2；7×24服务系数1.6
  
  // ===== Excel索引58-60: 多年期总价 =====
  year1TotalPrice?: number; // 索引58: 1年期总价
  year2TotalPrice?: number; // 索引59: 2年期总价(95折)
  year3TotalPrice?: number; // 索引60: 3年期总价(9折)
  
  // ===== Excel索引61-63: 其他地区总价 =====
  urbanPrice: number; // 索引61: 市区县城郊区总价(元/台·年)系数1.1
  townPrice: number; // 索引62: 乡镇总价(元/台·年)系数1.5
  ruralPrice: number; // 索引63: 农村总价(元/台·年)系数2.0
  
  // ===== Excel索引64: 维保内容 =====
  coreMaintenanceContent: string; // 索引64: 核心维保内容
  
  // ===== 补充的其他字段 =====
  unit?: string; // 单位（台/套/个等，补充字段）
  isActive?: boolean; // 是否启用（补充字段）
  lastUpdated?: string; // 最后更新时间（补充字段）
  dataSource?: string; // 数据来源（补充字段）
  
  // ===== 云数据中心设备专用字段 =====
  originalPrice?: number; // 中标单价（云数据中心设备使用此字段）
  quantity?: number; // 设备数量（云数据中心设备）
  annualFee?: number; // 年维保费（云数据中心设备）
  maintenanceRate?: number; // 维保率（云数据中心设备）
  networkType?: string; // 网络类型（内网/外网）
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
    baseFaultCount: 0.8, 
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

// 到场时间系数
export const ARRIVAL_TIME_FACTORS = {
  '2小时': 1.2,
  '8小时': 1.0,
};

// 响应时间系数
export const RESPONSE_TIME_FACTORS = {
  '10分钟': 1.1,
  '30分钟': 1.0,
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
  arrivalTime: ArrivalTimeType; // 到场时间 ('2小时'/'8小时')
  responseTime: ResponseTimeType; // 响应时间 ('10分钟'/'30分钟')
  serviceTime: ServiceTimeType; // 服务时间
}

// 默认SLA配置
export const DEFAULT_SLA_CONFIG: SLAConfig = {
  teamExperience: 1.2, // 有经验
  securityLevel: 0.95, // 第二级
  supportMode: 1.0, // 现场支持为主
  faultRecoveryTime: 1.0, // ≤24h
  arrivalTime: '2小时', // 2小时
  responseTime: '10分钟', // 10分钟
  serviceTime: '5×8',
};

// 计算SLA总系数
export function calculateSLATotalFactor(config: SLAConfig): number {
  const serviceTimeFactor = SERVICE_TIME_FACTORS[config.serviceTime];
  const arrivalTimeFactor = ARRIVAL_TIME_FACTORS[config.arrivalTime];
  const responseTimeFactor = RESPONSE_TIME_FACTORS[config.responseTime];
  return config.teamExperience * config.securityLevel * config.supportMode * 
         config.faultRecoveryTime * arrivalTimeFactor * responseTimeFactor * serviceTimeFactor;
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
