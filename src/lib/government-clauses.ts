
/**
 * 机关条款数据
 */

export interface GovernmentClause {
  id: string;
  title: string;
  content: string;
  category: string;
  effectiveDate?: string;
}

export const GOVERNMENT_CLAUSES: GovernmentClause[] = [
  {
    id: 'clause-1',
    title: '政府采购法相关规定',
    content: '依据《中华人民共和国政府采购法》及相关规定，维保服务需符合政府采购要求。',
    category: '法律法规'
  },
  {
    id: 'clause-2',
    title: '信息安全等级保护要求',
    content: '维保服务需符合《信息安全等级保护制度》的相关要求，确保系统安全稳定运行。',
    category: '安全要求'
  },
  {
    id: 'clause-3',
    title: '保密管理规定',
    content: '涉及国家秘密的设备维保，需严格遵守《中华人民共和国保守国家秘密法》及相关保密规定。',
    category: '保密要求'
  },
  {
    id: 'clause-4',
    title: '服务质量标准',
    content: '维保服务质量需符合国家或行业相关标准，确保服务质量达到规定要求。',
    category: '服务标准'
  },
  {
    id: 'clause-5',
    title: '应急响应要求',
    content: '需建立完善的应急响应机制，确保在发生故障时能够及时响应并恢复服务。',
    category: '应急响应'
  }
];
