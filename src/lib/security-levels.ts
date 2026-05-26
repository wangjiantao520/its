export interface SecurityLevel {
  level: 1 | 2 | 3 | 4 | 5;
  levelName: string;
  impactDescription: string;
  typicalSystems: string;
  slaCoefficient: number;
}

export const SECURITY_LEVELS: SecurityLevel[] = [
  {
    level: 1,
    levelName: '自主保护级',
    impactDescription: '损害公民/法人合法权益（一般）',
    typicalSystems: '普通办公、内网辅助系统',
    slaCoefficient: 0.9
  },
  {
    level: 2,
    levelName: '指导保护级',
    impactDescription: '严重损害公民/法人/或危害公共利益',
    typicalSystems: '普通业务政务、非核心政务',
    slaCoefficient: 0.95
  },
  {
    level: 3,
    levelName: '监督保护级',
    impactDescription: '严重危害公共利益/或危害国家安全',
    typicalSystems: '政务核心业务、金融、医疗',
    slaCoefficient: 1
  },
  {
    level: 4,
    levelName: '强制保护级',
    impactDescription: '特别严重危害公共利益/或严重危害国家安全',
    typicalSystems: '能源、交通、工控核心',
    slaCoefficient: 1.05
  },
  {
    level: 5,
    levelName: '专控保护级',
    impactDescription: '特别严重危害国家安全',
    typicalSystems: '国防、绝密指挥、核心密评',
    slaCoefficient: 1.1
  }
];

export function getSecurityLevel(level: 1 | 2 | 3 | 4 | 5) {
  return SECURITY_LEVELS.find(l => l.level === level);
}

export function getAllSecurityLevels() {
  return SECURITY_LEVELS;
}
