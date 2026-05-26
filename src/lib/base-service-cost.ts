export interface BaseServiceCost {
  serviceLevel: '5x8' | '7x8' | '7x24';
  workPeriod: string;
  workDuration: number;
  deviceUsage: number;
  wageFactor: number;
  effectiveCost: number;
  coefficient: number;
}

export const BASE_SERVICE_COSTS: BaseServiceCost[] = [
  {
    serviceLevel: '5x8',
    workPeriod: '工作日',
    workDuration: 40,
    deviceUsage: 100,
    wageFactor: 1,
    effectiveCost: 40,
    coefficient: 1
  },
  {
    serviceLevel: '7x8',
    workPeriod: '周末',
    workDuration: 16,
    deviceUsage: 25,
    wageFactor: 2,
    effectiveCost: 8,
    coefficient: 1.2
  },
  {
    serviceLevel: '7x24',
    workPeriod: '夜间',
    workDuration: 112,
    deviceUsage: 10,
    wageFactor: 1.5,
    effectiveCost: 16.8,
    coefficient: 1.62
  }
];

export function getBaseServiceCost(level: '5x8' | '7x8' | '7x24') {
  return BASE_SERVICE_COSTS.find(c => c.serviceLevel === level);
}

export function getAllBaseServiceCosts() {
  return BASE_SERVICE_COSTS;
}

export const BASE_SERVICE_COST_DESCRIPTION = `
基础服务成本：
- 各时段总成本 = 物理时长 × 设备使用率 × 该时段加班成本
- 工作日：40小时×100%使用率×1.0权重（无加班）
- 周末：16小时×25%×2.0权重（双倍工资）
- 夜间：112小时×10%×1.5权重（1.5倍工资）
`;
