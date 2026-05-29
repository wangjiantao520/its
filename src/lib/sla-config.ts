// SLA配置数据结构

// 运维团队经验类型
export type TeamExperienceType = '有' | '类似' | '无';

// 安全等级类型
export type SecurityLevelType = '一级' | '二级' | '三级' | '四级' | '五级';

// 支持方式类型
export type SupportModeType = '非现场支持为主' | '现场支持为主' | '纯现场支持';

// 故障恢复时间类型
export type FaultRecoveryTimeType = '≤4h' | '≤24h' | '≤48h' | '≤72h';

// 到场时间类型
export type ArrivalTimeType = '2小时' | '8小时';

// 响应时间类型
export type ResponseTimeType = '10分钟' | '30分钟';

// 服务时间类型
export type ServiceTimeType = '5×8' | '7×8' | '7×24';

// SLA配置接口
export interface SLAConfig {
  // 运维团队经验配置
  teamExperience: {
    [key in TeamExperienceType]: {
      label: string;
      factor: number;
    };
  };
  
  // 安全等级配置
  securityLevel: {
    [key in SecurityLevelType]: {
      label: string;
      factor: number;
    };
  };
  
  // 支持方式配置
  supportMode: {
    [key in SupportModeType]: {
      label: string;
      factor: number;
    };
  };
  
  // 故障恢复时间配置
  faultRecoveryTime: {
    [key in FaultRecoveryTimeType]: {
      label: string;
      factor: number;
    };
  };
  
  // 到场时间配置
  arrivalTime: {
    [key in ArrivalTimeType]: {
      label: string;
      factor: number;
    };
  };
  
  // 响应时间配置
  responseTime: {
    [key in ResponseTimeType]: {
      label: string;
      factor: number;
    };
  };
  
  // 服务时间配置
  serviceTime: {
    [key in ServiceTimeType]: {
      label: string;
      factor: number;
    };
  };
}

// 默认SLA配置（基于Excel）
export const DEFAULT_SLA_CONFIG: SLAConfig = {
  teamExperience: {
    '有': { label: '有', factor: 1.2 },
    '类似': { label: '类似', factor: 1.0 },
    '无': { label: '无', factor: 0.8 }
  },
  securityLevel: {
    '一级': { label: '一级', factor: 0.9 },
    '二级': { label: '二级', factor: 0.95 },
    '三级': { label: '三级', factor: 1.0 },
    '四级': { label: '四级', factor: 1.05 },
    '五级': { label: '五级', factor: 1.1 }
  },
  supportMode: {
    '非现场支持为主': { label: '非现场支持为主', factor: 0.89 },
    '现场支持为主': { label: '现场支持为主', factor: 1.0 },
    '纯现场支持': { label: '纯现场支持', factor: 1.1 }
  },
  faultRecoveryTime: {
    '≤4h': { label: '≤4h', factor: 1.2 },
    '≤24h': { label: '≤24h', factor: 1.0 },
    '≤48h': { label: '≤48h', factor: 0.9 },
    '≤72h': { label: '≤72h', factor: 0.85 }
  },
  arrivalTime: {
    '2小时': { label: '2小时', factor: 1.2 },
    '8小时': { label: '8小时', factor: 1.0 }
  },
  responseTime: {
    '10分钟': { label: '10分钟', factor: 1.1 },
    '30分钟': { label: '30分钟', factor: 1.0 }
  },
  serviceTime: {
    '5×8': { label: '5×8', factor: 1.0 },
    '7×8': { label: '7×8', factor: 1.2 },
    '7×24': { label: '7×24', factor: 1.6 }
  }
};

// 当前SLA配置（允许动态调整）
let currentSLAConfig: SLAConfig = { ...DEFAULT_SLA_CONFIG };

// 获取当前SLA配置
export function getSLAConfig(): SLAConfig {
  return currentSLAConfig;
}

// 更新SLA配置
export function updateSLAConfig(config: Partial<SLAConfig>): void {
  currentSLAConfig = { ...currentSLAConfig, ...config };
}

// 重置SLA配置为默认值
export function resetSLAConfig(): void {
  currentSLAConfig = { ...DEFAULT_SLA_CONFIG };
}

// 获取运维团队经验系数
export function getTeamExperienceFactor(type: TeamExperienceType): number {
  return currentSLAConfig.teamExperience[type]?.factor || 1.0;
}

// 获取安全等级系数
export function getSecurityLevelFactor(level: SecurityLevelType): number {
  return currentSLAConfig.securityLevel[level]?.factor || 1.0;
}

// 获取支持方式系数
export function getSupportModeFactor(mode: SupportModeType): number {
  return currentSLAConfig.supportMode[mode]?.factor || 1.0;
}

// 获取故障恢复时间系数
export function getFaultRecoveryTimeFactor(time: FaultRecoveryTimeType): number {
  return currentSLAConfig.faultRecoveryTime[time]?.factor || 1.0;
}

// 获取到场时间系数
export function getArrivalTimeFactor(time: ArrivalTimeType): number {
  return currentSLAConfig.arrivalTime[time]?.factor || 1.0;
}

// 获取响应时间系数
export function getResponseTimeFactor(time: ResponseTimeType): number {
  return currentSLAConfig.responseTime[time]?.factor || 1.0;
}

// 获取服务时间系数
export function getServiceTimeFactor(time: ServiceTimeType): number {
  return currentSLAConfig.serviceTime[time]?.factor || 1.0;
}

// 计算SLA总系数
export function calculateSLATotalFactor(
  teamExperience: TeamExperienceType,
  securityLevel: SecurityLevelType,
  supportMode: SupportModeType,
  faultRecoveryTime: FaultRecoveryTimeType,
  arrivalTime: ArrivalTimeType,
  responseTime: ResponseTimeType,
  serviceTime: ServiceTimeType
): number {
  const teamExpFactor = getTeamExperienceFactor(teamExperience);
  const securityFactor = getSecurityLevelFactor(securityLevel);
  const supportFactor = getSupportModeFactor(supportMode);
  const faultRecoveryFactor = getFaultRecoveryTimeFactor(faultRecoveryTime);
  const arrivalFactor = getArrivalTimeFactor(arrivalTime);
  const responseFactor = getResponseTimeFactor(responseTime);
  const serviceFactor = getServiceTimeFactor(serviceTime);
  
  return teamExpFactor * securityFactor * supportFactor * 
         faultRecoveryFactor * arrivalFactor * responseFactor * serviceFactor;
}

// SLA配置选项
export const SLA_CONFIG_OPTIONS = {
  teamExperience: [
    { value: '有' as TeamExperienceType, label: '有' },
    { value: '类似' as TeamExperienceType, label: '类似' },
    { value: '无' as TeamExperienceType, label: '无' }
  ],
  securityLevel: [
    { value: '一级' as SecurityLevelType, label: '一级' },
    { value: '二级' as SecurityLevelType, label: '二级' },
    { value: '三级' as SecurityLevelType, label: '三级' },
    { value: '四级' as SecurityLevelType, label: '四级' },
    { value: '五级' as SecurityLevelType, label: '五级' }
  ],
  supportMode: [
    { value: '非现场支持为主' as SupportModeType, label: '非现场支持为主' },
    { value: '现场支持为主' as SupportModeType, label: '现场支持为主' },
    { value: '纯现场支持' as SupportModeType, label: '纯现场支持' }
  ],
  faultRecoveryTime: [
    { value: '≤4h' as FaultRecoveryTimeType, label: '≤4h' },
    { value: '≤24h' as FaultRecoveryTimeType, label: '≤24h' },
    { value: '≤48h' as FaultRecoveryTimeType, label: '≤48h' },
    { value: '≤72h' as FaultRecoveryTimeType, label: '≤72h' }
  ],
  arrivalTime: [
    { value: '2小时' as ArrivalTimeType, label: '2小时' },
    { value: '8小时' as ArrivalTimeType, label: '8小时' }
  ],
  responseTime: [
    { value: '10分钟' as ResponseTimeType, label: '10分钟' },
    { value: '30分钟' as ResponseTimeType, label: '30分钟' }
  ],
  serviceTime: [
    { value: '5×8' as ServiceTimeType, label: '5×8' },
    { value: '7×8' as ServiceTimeType, label: '7×8' },
    { value: '7×24' as ServiceTimeType, label: '7×24' }
  ]
};