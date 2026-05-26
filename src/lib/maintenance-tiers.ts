
// 维保分档数据（基于Excel"设备与受理人员分档"工作表）
export interface MaintenanceTier {
  tier: string;        // 维保分档：A档/B档/C档/D档/E档
  tierName: string;    // 档次名称：简易型/基础型/中级型/高级型/专家型
  features: string;    // 设备特征描述
  engineerLevel: string; // 受理工程师等级
  representativeDevices: string; // 代表设备
}

export interface EngineerPrice {
  level: string;        // 工程师级别
  dailyRate: number;     // 工费（元/天）
}

// 维保分档数据
export const MAINTENANCE_TIERS: MaintenanceTier[] = [
  {
    tier: 'A档',
    tierName: '简易型',
    features: '结构简单、即插即用，故障多为清洁、接口类基础问题，维保操作无专业难度',
    engineerLevel: '初级工程师',
    representativeDevices: '声光报警器、防雷器、烟感报警器、温湿度传感器'
  },
  {
    tier: 'B档',
    tierName: '基础型',
    features: '标准办公通用设备，故障以软件调试、基础硬件检测为主，硬件模块化程度高，维保难度低',
    engineerLevel: '初级工程师',
    representativeDevices: '台式品牌/组装电脑、笔记本电脑、商用平板、一体机（触控/非触控）、单电脑'
  },
  {
    tier: 'C档',
    tierName: '中级型',
    features: '结构较复杂，涉及机械传动、光学部件或基础网络配置，需专业基础技能，部分需专用调试工具',
    engineerLevel: '中级工程师',
    representativeDevices: '手持PDA、家用/商用喷墨打印机、A4黑白激光打印机、馈纸A4扫描仪、工业款条码打印机'
  },
  {
    tier: 'D档',
    tierName: '高级型',
    features: '精密机电/光学/网络系统，结构复杂，需专业调试工具与资深技术能力，涉及系统配置、故障深度排查',
    engineerLevel: '高级工程师',
    representativeDevices: 'A3中速黑白复印机、A4黑白多功能一体机、≥65寸触摸屏一体机'
  },
  {
    tier: 'E档',
    tierName: '专家型',
    features: '大型精密设备/多模块联动系统，结构复杂且集成度高，维保需专业团队协作，涉及高端调试与系统联动优化',
    engineerLevel: '高级工程师',
    representativeDevices: '各尺寸会议大屏、各尺寸拼接屏、≤55寸监控大屏、≤5匹/5-10匹机房精密空调、≤12盘位磁盘阵列'
  }
];

// 工程师级别及工费（元/天）
export const ENGINEER_PRICES: EngineerPrice[] = [
  {
    level: '初级工程师',
    dailyRate: 404
  },
  {
    level: '中级工程师',
    dailyRate: 543
  },
  {
    level: '高级工程师',
    dailyRate: 700
  }
];

// 根据分档获取维保分档信息
export function getMaintenanceTier(tier: string): MaintenanceTier | undefined {
  return MAINTENANCE_TIERS.find(t =&gt; t.tier === tier || t.tier.replace('档', '') === tier);
}

// 根据等级获取工程师工费
export function getEngineerDailyRate(level: string): number {
  const price = ENGINEER_PRICES.find(p =&gt; p.level === level);
  return price ? price.dailyRate : 543; // 默认中级工程师
}

// 计算工时费（根据分钟数和工程师等级）
export function calculateLaborFee(minutes: number, engineerLevel: string): number {
  const dailyRate = getEngineerDailyRate(engineerLevel);
  const hourlyRate = dailyRate / 8; // 假设每天8小时
  const minuteRate = hourlyRate / 60;
  return parseFloat((minutes * minuteRate).toFixed(2));
}

// 获取所有维保分档
export function getAllMaintenanceTiers(): MaintenanceTier[] {
  return MAINTENANCE_TIERS;
}

// 获取所有工程师价格
export function getAllEngineerPrices(): EngineerPrice[] {
  return ENGINEER_PRICES;
}

// 根据设备特征判断建议分档（简易版本）
export function suggestMaintenanceTier(deviceName: string): MaintenanceTier {
  const lowerName = deviceName.toLowerCase();
  
  // 先检查代表设备
  for (const tier of MAINTENANCE_TIERS) {
    const devices = tier.representativeDevices.split('、');
    for (const device of devices) {
      if (lowerName.includes(device.toLowerCase())) {
        return tier;
      }
    }
  }
  
  // 默认返回B档
  return MAINTENANCE_TIERS[1];
}

