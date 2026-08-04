/**
 * 工程报价页面的类型定义与纯函数
 *
 * 从 engineering/page.tsx 抽取，不依赖 React state。
 */

import * as XLSX from 'xlsx';

export interface LaborPriceLevel {
  id: number;
  level: string;
  unitPrice: number;
  unit: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface QuoteItem {
  id: number;
  itemType: 'selfConstruction' | 'intelligent' | 'custom' | 'labor';
  itemId: string;
  quantity: number;
  // 自定义明细字段
  customName?: string;
  customUnit?: string;
  customPrice?: number;
  customRemark?: string;
  // 人工天计价字段
  laborLevelId?: number;       // 人工单价档位ID
  laborLevelName?: string;     // 人工等级名称（如：中级）
  laborUnitPrice?: number;     // 档位单价（人天）
  laborDays?: number;          // 预估用工天数
  laborDescription?: string;   // 工作内容描述
}

export interface EngineeringQuote {
  id: number;
  quote_number: string;
  project_name: string;
  client_name: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  construction_area: number | null;
  management_rate: number;
  profit_rate: number;
  regulatory_rate: number;
  tax_rate: number;
  subtotal: number;
  management_fee: number;
  profit: number;
  regulatory_fee: number;
  tax: number;
  total: number;
  status: string;
  items: Array<{
    itemType: string;
    itemId: string;
    quantity: number;
    name: string;
    unit: string;
    price: number;
    customRemark?: string;
    laborLevelId?: number;
    laborLevelName?: string;
    laborUnitPrice?: number;
    laborDays?: number;
    laborDescription?: string;
  }> | null;
  created_at: string;
  updated_at: string;
}

// 统计数据接口
export interface StatsOverview {
  totalCount: number;
  totalAmount: number;
  avgAmount: number;
  maxAmount: number;
  minAmount: number;
}

export interface StatsByStatus {
  status: string;
  count: number;
  totalAmount: number;
}

export interface StatsByMonth {
  month: string;
  count: number;
  totalAmount: number;
}

export interface StatsByClient {
  clientName: string;
  count: number;
  totalAmount: number;
}

export interface StatsByAmountRange {
  range: string;
  count: number;
}

export interface StatsData {
  overview: StatsOverview;
  byStatus: StatsByStatus[];
  byMonth: StatsByMonth[];
  byClient: StatsByClient[];
  byAmountRange: StatsByAmountRange[];
  thisMonth: {
    count: number;
    totalAmount: number;
    countChange: number;
    amountChange: number;
  };
}

/** 定额类型 */
export type QuotaType = 'selfConstruction' | 'intelligent';

/**
 * 下载定额导入模板
 * 从 page.tsx 抽取为纯函数。
 */
export function downloadQuotaTemplate(type: QuotaType): void {
  const isSelf = type === 'selfConstruction';
  const headers = isSelf
    ? ['编号', '分类', '名称', '单位', '数量', '单价', '备注']
    : ['编号', '序号', '分类', '名称', '品牌型号', '描述', '可抵扣税率', '单位', '单价', '备注'];

  const sampleRows = isSelf
    ? [
        ['1', '宽带、专线项目', '光缆布放', '米', 1, 1.65, '施工测量、做拉线'],
        ['2', '常规内部布线', '网线布放', '米', 1, 3.5, '含网线材料'],
      ]
    : [
        ['I-1', 1, '设备', '高清摄像头', '海康威视DS-2CD3T46', '400万像素', 13, '台', 800, '含安装'],
        ['I-2', 2, '施工安装', '摄像机安装', '', '包括定位、固定、接线', 6, '台', 150, '含辅料'],
      ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = headers.map(() => ({ wch: 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isSelf ? '自施工定额' : '智能化定额');
  XLSX.writeFile(wb, isSelf ? '自施工定额导入模板.xlsx' : '智能化定额导入模板.xlsx');
}
