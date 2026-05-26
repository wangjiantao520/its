
/**
 * 工具摊销测算依据
 */

export interface ToolAmortization {
  id: string;
  toolName: string;
  toolType: string;
  unitPrice: number;
  serviceLife: number;
  annualAmortization: number;
  coverageRange: string;
}

export const TOOL_AMORTIZATION_DATA: ToolAmortization[] = [
  {
    id: 'tool-1',
    toolName: '网络测试仪',
    toolType: '网络诊断',
    unitPrice: 15000,
    serviceLife: 5,
    annualAmortization: 3000,
    coverageRange: '网络设备维护'
  },
  {
    id: 'tool-2',
    toolName: '光纤熔接机',
    toolType: '光纤施工',
    unitPrice: 50000,
    serviceLife: 5,
    annualAmortization: 10000,
    coverageRange: '光纤线路维护'
  },
  {
    id: 'tool-3',
    toolName: '服务器诊断工具',
    toolType: '服务器维护',
    unitPrice: 20000,
    serviceLife: 5,
    annualAmortization: 4000,
    coverageRange: '服务器维护'
  },
  {
    id: 'tool-4',
    toolName: '万用表套装',
    toolType: '电气测量',
    unitPrice: 5000,
    serviceLife: 5,
    annualAmortization: 1000,
    coverageRange: '通用电气维护'
  },
  {
    id: 'tool-5',
    toolName: '示波器',
    toolType: '信号分析',
    unitPrice: 30000,
    serviceLife: 5,
    annualAmortization: 6000,
    coverageRange: '信号设备维护'
  },
  {
    id: 'tool-6',
    toolName: '笔记本电脑（维护专用）',
    toolType: '通用工具',
    unitPrice: 10000,
    serviceLife: 3,
    annualAmortization: 3333,
    coverageRange: '各类设备维护'
  },
  {
    id: 'tool-7',
    toolName: '标签打印机',
    toolType: '标识工具',
    unitPrice: 3000,
    serviceLife: 5,
    annualAmortization: 600,
    coverageRange: '设备标识管理'
  },
  {
    id: 'tool-8',
    toolName: '线缆测试仪',
    toolType: '线缆诊断',
    unitPrice: 8000,
    serviceLife: 5,
    annualAmortization: 1600,
    coverageRange: '综合布线维护'
  }
];

export const TOOL_AMORTIZATION_CONFIG = {
  defaultServiceLife: 5,
  amortizationMethod: '直线法',
  residualValueRate: 0.05,
  maintenanceFactor: 0.2
};
