
/**
 * 工具摊销测算依据
 * 
 * 维保分档 | A档（简易型） | B档（基础型） | C档（中级型） | D档（高级型） | E档（专家型）
 * 工程师等级 | 初级工程师 | 初级工程师 | 中级工程师 | 高级工程师 | 高级工程师
 * 工具类型 | 基础通用工具 | 基础+简易检测工具 | 基础+专业校准/调试工具 | 基础+高端检测/调试工具 | 全套+大型/专用调试设备
 * 工具采购总成本（元） | 80 | 170 | 300 | 1060 | 2460
 * 工具预计使用年限（年） | 5（基础工具，无精度衰减） | 5（基础+电子简易检测） | 3（精密校准，含年校准） | 3（工业级检测，含年专业校准） | 3（大型/超高精度，含原厂校准+机械损耗）
 * 单套工具年覆盖设备量（台） | 200（通用性极强） | 150（通用性较强） | 100（适配性强） | 60（专用性极强） | 40（仅适配核心大型设备）
 * 年额外成本（校准/损耗，元） | 0（无额外成本） | 0（基础电子，无校准） | 50（年简易校准费，乘以3年） | 318（年专业校准费，10%采购成本，乘以3年） | 1707（年原厂校准15%+机械损耗200/年，乘以3年）
 * 工具年摊销成本（元） | 16.00 | 34.00 | 116.67 | 459.33 | 1389.00
 * （采购成本+总额外成本）÷ 使用年限
 * 理论单台摊销费（元） | 0.08 | 0.23 | 1.67 | 7.66 | 34.73
 * 年摊销成本÷ 年覆盖设备量
 * 调整类型 | 行业实操中基础工具综合损耗系数（作业/管理/易耗材） | 行业实操中基础工具综合损耗系数（电子件易耗材+管理） | 校准+行业实操中基础工具综合损耗系数（精密部件+管理） | 校准+行业实操中基础工具综合损耗系数（精密部件+管理） | 行业实操中基础工具综合损耗系数（电子件易耗材+管理）
 * 调整系数数值 | 20 | 10 | 1.5 | 0.5 | 0.1
 * 核定摊销定价（元/台·年） | 1.6 | 2.27 | 2.50 | 3.83 | 3.47
 *
 * 工具清单：
 * A档：螺丝刀套装15元、普通数字万用表40元、普通扳手15元、基础清洁套装10元
 * B档：基础通用工具80元+网线测试仪35元、普通信号测试仪45元、剥线钳10元
 * C档：基础通用工具80元+打印头校准工具60元、触控测试工具80元、云台调试支架50元、精密清洁套装30元
 * D档：基础通用工具80元+工程宝350元、光纤红笔/光功率计200元、亮度/色彩测试仪180元、工业级网线测试仪250元
 * E档：基础工具80元+高端工具980元+吊装调试工具400元、高精度光纤测试仪350元、温湿度记录仪200元、拼接屏专业调试工具300元、防静电专用套装150元
 *
 * 成本覆盖说明：
 * A档：覆盖基础工具采购、全场景损耗、日常管理成本
 * B档：覆盖基础+简易检测工具采购、电子件易耗、管理成本
 * C档：覆盖精密工具采购、年校准、精密部件损耗成本
 * D档：覆盖工业级工具采购、专业校准、集采折扣后全成本
 * E档：覆盖大型/专用设备采购、原厂校准、机械损耗，依托E档高维保单价分摊全成本
 */

export interface ToolAmortizationTier {
  tier: 'A' | 'B' | 'C' | 'D' | 'E';
  tierName: string;
  engineerLevel: '初级工程师' | '中级工程师' | '高级工程师';
  toolType: string;
  toolTotalCost: number;
  serviceLifeYears: number;
  annualDeviceCoverage: number;
  annualExtraCost: number;
  totalExtraCost: number;
  annualAmortizationCost: number;
  theoreticalAmortizationPerDevice: number;
  adjustmentType: string;
  adjustmentFactor: number;
  finalAmortizationPrice: number;
  toolList: string;
  costCoverageDescription: string;
}

export const TOOL_AMORTIZATION_TIERS: ToolAmortizationTier[] = [
  {
    tier: 'A',
    tierName: '简易型',
    engineerLevel: '初级工程师',
    toolType: '基础通用工具',
    toolTotalCost: 80,
    serviceLifeYears: 5,
    annualDeviceCoverage: 200,
    annualExtraCost: 0,
    totalExtraCost: 0,
    annualAmortizationCost: 16.00,
    theoreticalAmortizationPerDevice: 0.08,
    adjustmentType: '行业实操中基础工具综合损耗系数（作业/管理/易耗材）',
    adjustmentFactor: 20,
    finalAmortizationPrice: 1.6,
    toolList: '螺丝刀套装15元、普通数字万用表40元、普通扳手15元、基础清洁套装10元',
    costCoverageDescription: '覆盖基础工具采购、全场景损耗、日常管理成本'
  },
  {
    tier: 'B',
    tierName: '基础型',
    engineerLevel: '初级工程师',
    toolType: '基础+简易检测工具',
    toolTotalCost: 170,
    serviceLifeYears: 5,
    annualDeviceCoverage: 150,
    annualExtraCost: 0,
    totalExtraCost: 0,
    annualAmortizationCost: 34.00,
    theoreticalAmortizationPerDevice: 0.23,
    adjustmentType: '行业实操中基础工具综合损耗系数（电子件易耗材+管理）',
    adjustmentFactor: 10,
    finalAmortizationPrice: 2.27,
    toolList: '基础通用工具80元+网线测试仪35元、普通信号测试仪45元、剥线钳10元',
    costCoverageDescription: '覆盖基础+简易检测工具采购、电子件易耗、管理成本'
  },
  {
    tier: 'C',
    tierName: '中级型',
    engineerLevel: '中级工程师',
    toolType: '基础+专业校准/调试工具',
    toolTotalCost: 300,
    serviceLifeYears: 3,
    annualDeviceCoverage: 100,
    annualExtraCost: 50,
    totalExtraCost: 150,
    annualAmortizationCost: 116.67,
    theoreticalAmortizationPerDevice: 1.67,
    adjustmentType: '校准+行业实操中基础工具综合损耗系数（精密部件+管理）',
    adjustmentFactor: 1.5,
    finalAmortizationPrice: 2.50,
    toolList: '基础通用工具80元+打印头校准工具60元、触控测试工具80元、云台调试支架50元、精密清洁套装30元',
    costCoverageDescription: '覆盖精密工具采购、年校准、精密部件损耗成本'
  },
  {
    tier: 'D',
    tierName: '高级型',
    engineerLevel: '高级工程师',
    toolType: '基础+高端检测/调试工具',
    toolTotalCost: 1060,
    serviceLifeYears: 3,
    annualDeviceCoverage: 60,
    annualExtraCost: 318,
    totalExtraCost: 954,
    annualAmortizationCost: 459.33,
    theoreticalAmortizationPerDevice: 7.66,
    adjustmentType: '校准+行业实操中基础工具综合损耗系数（精密部件+管理）',
    adjustmentFactor: 0.5,
    finalAmortizationPrice: 3.83,
    toolList: '基础通用工具80元+工程宝350元、光纤红笔/光功率计200元、亮度/色彩测试仪180元、工业级网线测试仪250元',
    costCoverageDescription: '覆盖工业级工具采购、专业校准、集采折扣后全成本'
  },
  {
    tier: 'E',
    tierName: '专家型',
    engineerLevel: '高级工程师',
    toolType: '全套+大型/专用调试设备',
    toolTotalCost: 2460,
    serviceLifeYears: 3,
    annualDeviceCoverage: 40,
    annualExtraCost: 1707,
    totalExtraCost: 5121,
    annualAmortizationCost: 1389.00,
    theoreticalAmortizationPerDevice: 34.73,
    adjustmentType: '行业实操中基础工具综合损耗系数（电子件易耗材+管理）',
    adjustmentFactor: 0.1,
    finalAmortizationPrice: 3.47,
    toolList: '基础工具80元+高端工具980元+吊装调试工具400元、高精度光纤测试仪350元、温湿度记录仪200元、拼接屏专业调试工具300元、防静电专用套装150元',
    costCoverageDescription: '覆盖大型/专用设备采购、原厂校准、机械损耗，依托E档高维保单价分摊全成本'
  }
];

export function getToolAmortizationByTier(tier: string) {
  return TOOL_AMORTIZATION_TIERS.find(t => t.tier === tier);
}

export function getAllToolAmortizationTiers() {
  return TOOL_AMORTIZATION_TIERS;
}

