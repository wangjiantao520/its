
/**
 * 备件金测算原则
 */

export interface SparePartPrinciple {
  id: string;
  principleName: string;
  description: string;
}

export const SPARE_PART_PRINCIPLES: SparePartPrinciple[] = [
  {
    id: 'tier-based',
    principleName: '维保分档原则',
    description: 'A档（简易型）30-80元，B档（基础型）60-120元，C档（中级型）100-220元，D档（高级型）200-800元，E档（专家型）500-3000元，分档越高准备金越高'
  },
  {
    id: 'value-based',
    principleName: '设备价值原则',
    description: '高价值设备（如服务器、大屏、精密空调）准备金占设备价值比例约3%-5%，普通设备约2%-3%'
  },
  {
    id: 'usage-scenario-based',
    principleName: '使用场景原则',
    description: '户外、高频使用、移动场景设备准备金上浮20%-50%，室内稳定环境设备维持基础水平'
  },
  {
    id: 'part-universality-based',
    principleName: '备件通用性原则',
    description: '专用备件、稀缺备件准备金上浮50%-100%，通用标准化备件维持基础水平'
  },
  {
    id: 'fault-probability-based',
    principleName: '故障概率原则',
    description: '易损件多、结构复杂、集成度高的设备准备金显著高于结构简单设备'
  }
];

export const SPARE_PART_TIER_RANGES = {
  'A': { min: 30, max: 80, description: '简易型' },
  'B': { min: 60, max: 120, description: '基础型' },
  'C': { min: 100, max: 220, description: '中级型' },
  'D': { min: 200, max: 800, description: '高级型' },
  'E': { min: 500, max: 3000, description: '专家型' }
};

export const SPARE_PART_ADJUSTMENT_FACTORS = {
  value: {
    high: 0.03,
    normal: 0.025
  },
  usage: {
    outdoor: 1.35,
    indoor: 1.0
  },
  part: {
    special: 1.75,
    common: 1.0
  }
};

