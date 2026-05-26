/**
 * 单套工具年覆盖设备量
 */

export interface ToolCoverage {
  level: 'A' | 'B' | 'C' | 'D' | 'E';
  levelName: string;
  coreLogic: string;
  keyParameter: string;
  calculationDerivation: string;
  annualCoverage: number;
}

export const TOOL_COVERAGE_DATA: ToolCoverage[] = [
  {
    level: 'A',
    levelName: 'A档（简易型）',
    coreLogic: '工具通用性极强，几乎适配所有基础设备，单次维保耗时极短，工具可高频复用',
    keyParameter: '日均服务设备数：1台/0.5小时→8台/工作日；年有效作业天数：250天（扣除周末/节假日）；工具复用系数：1（无等待/闲置）',
    calculationDerivation: '8×250×1=200台/年',
    annualCoverage: 200
  },
  {
    level: 'B',
    levelName: 'B档（基础型）',
    coreLogic: '工具通用性较强，覆盖办公/基础网络设备，单次维保耗时略长，工具复用率稍降',
    keyParameter: '日均服务设备数：1台/0.67小时→6台/工作日；年有效作业天数：250天；工具复用系数：1',
    calculationDerivation: '6×250×1=150台/年',
    annualCoverage: 150
  },
  {
    level: 'C',
    levelName: 'C档（中级型）',
    coreLogic: '工具适配性强，聚焦精密办公/轻专业设备，单次维保需专业调试，耗时增加',
    keyParameter: '日均服务设备数：1台/1小时→4台/工作日；年有效作业天数：250天；工具复用系数：1',
    calculationDerivation: '4×250×1=100台/年',
    annualCoverage: 100
  },
  {
    level: 'D',
    levelName: 'D档（高级型）',
    coreLogic: '工具专用性极强，仅适配精密机电/网络设备，单次维保需深度调试，工具闲置率上升',
    keyParameter: '日均服务设备数：1台/1.67小时→2.4台/工作日；年有效作业天数：250天；工具复用系数：1',
    calculationDerivation: '2.4×250×1=60台/年',
    annualCoverage: 60
  },
  {
    level: 'E',
    levelName: 'E档（专家型）',
    coreLogic: '工具仅适配核心大型设备，设备数量少、单次维保需团队协作，工具复用率最低',
    keyParameter: '日均服务设备数：1台/2.5小时→1.6台/工作日；年有效作业天数：250天；工具复用系数：1',
    calculationDerivation: '1.6×250×1=40台/年',
    annualCoverage: 40
  }
];

export function getToolCoverageByLevel(level: 'A' | 'B' | 'C' | 'D' | 'E'): ToolCoverage | undefined {
  return TOOL_COVERAGE_DATA.find(item => item.level === level);
}

export function getAllToolCoverage() {
  return TOOL_COVERAGE_DATA;
}
