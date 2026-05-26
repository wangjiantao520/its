
/**
 * 备件金测算原则
 */

export interface SparePartPrinciple {
  id: string;
  principleName: string;
  description: string;
  calculationMethod: string;
  applicableScenarios: string[];
}

export const SPARE_PART_PRINCIPLES: SparePartPrinciple[] = [
  {
    id: 'principle-1',
    principleName: '按设备价值比例测算',
    description: '根据设备采购价值的一定比例测算备件金',
    calculationMethod: '备件金 = 设备采购价 × 备件比例系数',
    applicableScenarios: ['通用设备', '标准配置设备']
  },
  {
    id: 'principle-2',
    principleName: '按故障概率测算',
    description: '根据设备历史故障概率和备件价格测算备件金',
    calculationMethod: '备件金 = Σ(备件价格 × 故障概率 × 备件数量)',
    applicableScenarios: ['有完整历史数据的设备', '大型系统']
  },
  {
    id: 'principle-3',
    principleName: '按维保等级测算',
    description: '根据不同维保等级对应的备件覆盖率测算备件金',
    calculationMethod: '备件金 = 基础备件金 × 维保等级系数',
    applicableScenarios: ['分级维保服务', '差异化服务需求']
  },
  {
    id: 'principle-4',
    principleName: '按设备数量测算',
    description: '根据同类型设备数量和单设备备件金测算总额',
    calculationMethod: '备件金 = 单设备备件金 × 设备数量 × 共享系数',
    applicableScenarios: ['批量相同设备', '设备池化管理']
  },
  {
    id: 'principle-5',
    principleName: '按服务年限测算',
    description: '根据维保服务年限逐年调整备件金',
    calculationMethod: '年度备件金 = 基础备件金 × (1 + 年递增率)^服务年限',
    applicableScenarios: ['长期维保合同', '设备老化考虑']
  }
];

export const SPARE_PART_RATIOS = {
  '计算机终端类': 0.08,
  '办公外设与存储': 0.10,
  '网络设备类': 0.12,
  '安防监控类': 0.09,
  '会议系统类': 0.11,
  '服务器与存储类': 0.15
};
