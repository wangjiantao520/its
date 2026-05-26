
/**
 * 单套工具年覆盖设备量
 */

export interface ToolCoverage {
  id: string;
  toolName: string;
  toolType: string;
  annualCoverage: number;
  applicableEquipment: string[];
  coverageDescription: string;
}

export const TOOL_COVERAGE_DATA: ToolCoverage[] = [
  {
    id: 'coverage-1',
    toolName: '网络测试仪',
    toolType: '网络诊断',
    annualCoverage: 200,
    applicableEquipment: ['网络交换机', '路由器', '防火墙'],
    coverageDescription: '单套网络测试仪年可覆盖200台网络设备的测试和诊断'
  },
  {
    id: 'coverage-2',
    toolName: '光纤熔接机',
    toolType: '光纤施工',
    annualCoverage: 50,
    applicableEquipment: ['光纤链路', '光模块'],
    coverageDescription: '单套光纤熔接机年可覆盖50个光纤熔接项目'
  },
  {
    id: 'coverage-3',
    toolName: '服务器诊断工具',
    toolType: '服务器维护',
    annualCoverage: 100,
    applicableEquipment: ['机架式服务器', '塔式服务器', '刀片服务器'],
    coverageDescription: '单套服务器诊断工具年可覆盖100台服务器的诊断'
  },
  {
    id: 'coverage-4',
    toolName: '万用表套装',
    toolType: '电气测量',
    annualCoverage: 500,
    applicableEquipment: ['各类电子设备', '电源设备'],
    coverageDescription: '单套万用表套装年可覆盖500台设备的电气测量'
  },
  {
    id: 'coverage-5',
    toolName: '示波器',
    toolType: '信号分析',
    annualCoverage: 80,
    applicableEquipment: ['视频会议设备', '音响设备', '信号设备'],
    coverageDescription: '单套示波器年可覆盖80台信号设备的分析'
  },
  {
    id: 'coverage-6',
    toolName: '笔记本电脑（维护专用）',
    toolType: '通用工具',
    annualCoverage: 300,
    applicableEquipment: ['各类IT设备'],
    coverageDescription: '单套维护专用笔记本年可支持300台设备的维护工作'
  },
  {
    id: 'coverage-7',
    toolName: '线缆测试仪',
    toolType: '线缆诊断',
    annualCoverage: 150,
    applicableEquipment: ['网络线缆', '综合布线系统'],
    coverageDescription: '单套线缆测试仪年可覆盖150条线缆的测试'
  },
  {
    id: 'coverage-8',
    toolName: '标签打印机',
    toolType: '标识工具',
    annualCoverage: 1000,
    applicableEquipment: ['所有需要标识的设备'],
    coverageDescription: '单套标签打印机年可完成1000个设备标签的打印'
  }
];

export const COVERAGE_FACTORS = {
  '城区': 1.2,
  '市区': 1.0,
  '乡镇': 0.8,
  '农村': 0.6
};

export const getToolCoverageByType = (toolType: string): ToolCoverage | undefined => {
  return TOOL_COVERAGE_DATA.find(coverage => coverage.toolType === toolType);
};

export const getToolCoverageByEquipment = (equipmentName: string): ToolCoverage[] => {
  return TOOL_COVERAGE_DATA.filter(coverage =>
    coverage.applicableEquipment.some(eq => equipmentName.includes(eq))
  );
};
