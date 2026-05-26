
/**
 * 维保查勘问询术语解释
 */

export interface SurveyTerminology {
  id: string;
  term: string;
  definition: string;
  category?: string;
}

export const SURVEY_TERMINOLOGY: SurveyTerminology[] = [
  {
    id: 'term-1',
    term: 'SLA（服务级别协议）',
    definition: '服务级别协议（Service Level Agreement），规定了服务提供商应提供的服务水平、响应时间、可用性等指标。',
    category: '服务术语'
  },
  {
    id: 'term-2',
    term: 'MTTR（平均修复时间）',
    definition: '平均修复时间（Mean Time To Repair），指从故障发生到系统恢复正常的平均时间。',
    category: '技术术语'
  },
  {
    id: 'term-3',
    term: 'MTBF（平均无故障时间）',
    definition: '平均无故障时间（Mean Time Between Failures），指两次故障之间的平均时间间隔。',
    category: '技术术语'
  },
  {
    id: 'term-4',
    term: '7x24小时服务',
    definition: '指每周7天、每天24小时提供服务，包括节假日。',
    category: '服务时间'
  },
  {
    id: 'term-5',
    term: '5x8小时服务',
    definition: '指每周5个工作日、每天8小时提供服务，通常指工作日的工作时间。',
    category: '服务时间'
  },
  {
    id: 'term-6',
    term: '备件先行',
    definition: '指在故障发生时，先提供备件更换，再进行故障件维修的服务方式。',
    category: '服务方式'
  },
  {
    id: 'term-7',
    term: '远程支持',
    definition: '通过远程连接方式对设备进行故障诊断和技术支持的服务方式。',
    category: '服务方式'
  },
  {
    id: 'term-8',
    term: '现场服务',
    definition: '技术人员到设备现场进行维修、维护等服务的方式。',
    category: '服务方式'
  },
  {
    id: 'term-9',
    term: '巡检服务',
    definition: '定期对设备进行检查、维护、保养的预防性服务。',
    category: '服务内容'
  },
  {
    id: 'term-10',
    term: '成新率',
    definition: '指设备的新旧程度，通常以百分比表示，用于计算维保费用的调整系数。',
    category: '费用计算'
  }
];
