// 设备分档和成新率数据

// 成新率等级
export type DepreciationGrade = 1 | 2 | 3 | 4 | 5;

// 设备分档
export type DeviceGrade = 'A' | 'B' | 'C' | 'D' | 'E';

// 设备分档数据接口
export interface DeviceGradeData {
  grade: DeviceGrade;
  yearlyFaultBase: number; // 年故障数基准值
  depreciationFactors: {
    [key in DepreciationGrade]: number;
  };
  remark: string;
  // 维保分档详细数据
  gradeName: string; // 分档名称（简易型、基础型、中级型、高级型、专家型）
  engineerLevel: string; // 工程师等级
  toolType: string; // 工具类型
  toolPurchaseCost: number; // 工具采购总成本（元）
  toolUseYears: number; // 工具预计使用年限（年）
  coverageDeviceCount: number; // 单套工具年覆盖设备量（台）
  annualExtraCost: number; // 年额外成本（校准/损耗，元）
  toolYearlyAmortization: number; // 工具年摊销成本（元）
  theoreticalUnitAmortization: number; // 理论单台摊销费（元）
  adjustmentType: string; // 调整类型
  adjustmentFactor: number; // 调整系数值
  approvedAmortizationPrice: number; // 核定摊销定价（元/台·年）
  toolList: string; // 工具清单
  costCoverage: string; // 成本覆盖说明
}

// 设备分档数据
export const DEVICE_GRADE_DATA: DeviceGradeData[] = [
  {
    grade: 'A',
    yearlyFaultBase: 1,
    depreciationFactors: {
      1: 0.6,
      2: 0.8,
      3: 1,
      4: 1.3,
      5: 1.6
    },
    remark: '结构简单、即插即用，如烟感报警器、温湿度传感器',
    gradeName: '简易型',
    engineerLevel: '初级',
    toolType: '基础通用工具',
    toolPurchaseCost: 80,
    toolUseYears: 5,
    coverageDeviceCount: 200,
    annualExtraCost: 0,
    toolYearlyAmortization: 16.00,
    theoreticalUnitAmortization: 0.08,
    adjustmentType: '行业实操中基础工具综合损耗系数（作业/管理/易耗件）',
    adjustmentFactor: 2.0,
    approvedAmortizationPrice: 1.6,
    toolList: '螺丝刀套装15元、普通数字万用表40元、普通扳手15元、基础清洁套装10元',
    costCoverage: '覆盖基础工具采购、全景损耗、日常管理成本'
  },
  {
    grade: 'B',
    yearlyFaultBase: 2,
    depreciationFactors: {
      1: 1.2,
      2: 1.6,
      3: 2,
      4: 2.6,
      5: 3.2
    },
    remark: '标准办公通用设备，具备基础网络连接功能',
    gradeName: '基础型',
    engineerLevel: '初级',
    toolType: '基础+简易检测工具',
    toolPurchaseCost: 170,
    toolUseYears: 5,
    coverageDeviceCount: 150,
    annualExtraCost: 0,
    toolYearlyAmortization: 34.00,
    theoreticalUnitAmortization: 0.23,
    adjustmentType: '行业实操中基础工具综合损耗系数（电子件易耗+管理）',
    adjustmentFactor: 2.27,
    approvedAmortizationPrice: 1.6,
    toolList: '基础通用工具80元+网线测试仪35元、普通信号测试仪45元、剥线钳10元',
    costCoverage: '覆盖基础+简易检测工具采购、电子件易耗、管理成本'
  },
  {
    grade: 'C',
    yearlyFaultBase: 2.4,
    depreciationFactors: {
      1: 1.44,
      2: 1.92,
      3: 2.4,
      4: 3.12,
      5: 3.84
    },
    remark: '结构较复杂，涉及基础网动与光学组件',
    gradeName: '中级型',
    engineerLevel: '中级',
    toolType: '基础+专业检测/调试工具',
    toolPurchaseCost: 300,
    toolUseYears: 3,
    coverageDeviceCount: 100,
    annualExtraCost: 50,
    toolYearlyAmortization: 116.67,
    theoreticalUnitAmortization: 1.17,
    adjustmentType: '校准+行业实操中基础工具综合损耗系数（精密部件+管理）',
    adjustmentFactor: 1.5,
    approvedAmortizationPrice: 1.6,
    toolList: '基础通用工具80元+打印头校准工具60元、触测试工具80元、云台调试支架50元、精密清洁套装30元',
    costCoverage: '覆盖精密工具采购、年校准、精密部件损耗成本'
  },
  {
    grade: 'D',
    yearlyFaultBase: 1.8,
    depreciationFactors: {
      1: 1.08,
      2: 1.44,
      3: 1.8,
      4: 2.34,
      5: 2.88
    },
    remark: '集成精密机电、光学扫描与复杂网络系统',
    gradeName: '高级型',
    engineerLevel: '高级',
    toolType: '基础+高端检测/调试工具',
    toolPurchaseCost: 1060,
    toolUseYears: 3,
    coverageDeviceCount: 60,
    annualExtraCost: 318,
    toolYearlyAmortization: 459.33,
    theoreticalUnitAmortization: 7.66,
    adjustmentType: '校准+行业实操中基础工具综合损耗系数（精密部件+管理）',
    adjustmentFactor: 0.5,
    approvedAmortizationPrice: 3.83,
    toolList: '基础通用工具80元+工程宝350元、光纤红光笔/光功率计200元、亮度/彩测试仪180元、工业级网线测试仪250元',
    costCoverage: '覆盖工业级工具采购、专业校准、集采折扣后全成本'
  },
  {
    grade: 'E',
    yearlyFaultBase: 1.2,
    depreciationFactors: {
      1: 0.72,
      2: 0.96,
      3: 1.2,
      4: 1.56,
      5: 1.92
    },
    remark: '大型精密设备、多模块或移动式业务主机',
    gradeName: '专家型',
    engineerLevel: '高级',
    toolType: '全套+大型/专用调试设备',
    toolPurchaseCost: 2460,
    toolUseYears: 3,
    coverageDeviceCount: 40,
    annualExtraCost: 1707,
    toolYearlyAmortization: 1389.00,
    theoreticalUnitAmortization: 34.73,
    adjustmentType: '校准+行业实操中基础工具综合损耗系数（电子件易耗+管理）',
    adjustmentFactor: 0.1,
    approvedAmortizationPrice: 3.47,
    toolList: '基础工具80+高端工具980+装调试工具400元、高精度光纤测试仪350元、温湿度记录仪200元、拼接屏专用调试工具300元、防静电专用套装150元',
    costCoverage: '覆盖大型/专用设备采购、原厂校准、机械损耗，依托t8维保单价分档全成本'
  }
];

// 获取设备分档数据
export function getDeviceGradeData(grade: DeviceGrade): DeviceGradeData | undefined {
  return DEVICE_GRADE_DATA.find(d => d.grade === grade);
}

// 获取成新率系数
export function getDepreciationFactor(grade: DeviceGrade, depreciationGrade: DepreciationGrade): number {
  const gradeData = getDeviceGradeData(grade);
  return gradeData?.depreciationFactors[depreciationGrade] || 1;
}

// 设备分档选项
export const DEVICE_GRADE_OPTIONS: { value: DeviceGrade; label: string }[] = [
  { value: 'A', label: 'A档 - 简易型' },
  { value: 'B', label: 'B档 - 基础型' },
  { value: 'C', label: 'C档 - 中级型' },
  { value: 'D', label: 'D档 - 高级型' },
  { value: 'E', label: 'E档 - 专家型' }
];

// 成新率等级选项
export const DEPRECIATION_GRADE_OPTIONS: { value: DepreciationGrade; label: string }[] = [
  { value: 1, label: '1级 - 全新' },
  { value: 2, label: '2级 - 较新' },
  { value: 3, label: '3级 - 一般' },
  { value: 4, label: '4级 - 偏旧' },
  { value: 5, label: '5级 - 老旧' }
];