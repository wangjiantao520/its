/**
 * 工程报价页面的类型定义与纯函数
 *
 * 从 engineering/page.tsx 抽取，不依赖 React state。
 */

import * as XLSX from 'xlsx';
import { convertToChineseCurrency, type EngineeringQuoteExportData } from '@/lib/export-utils';

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
  // 归属位置（楼层）
  location?: string;
  // 采购价与加价率
  purchasePrice?: number;
  markupRate?: number;
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
  crcc_rate: number;
  crcc_fee: number;
  cmcc_rate: number;
  cmcc_fee: number;
  status: string;
  items: Array<{
    itemType: string;
    itemId: string;
    quantity: number;
    name: string;
    unit: string;
    price: number;
    location?: string;
    purchasePrice?: number;
    markupRate?: number;
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

/** 从数据库行构造导出数据，统一填充三套取费与归属位置 */
export function buildEngineeringExportDataFromQuote(quote: EngineeringQuote): EngineeringQuoteExportData {
  const num = (v: unknown): number => Number(v) || 0;
  const tierMode = num(quote.crcc_rate) > 0 || num(quote.cmcc_rate) > 0;
  const taxRate = tierMode ? num(quote.tax_rate) || 6 : num(quote.tax_rate) || 13;
  const crccRate = num(quote.crcc_rate);
  const cmccRate = num(quote.cmcc_rate);
  const taxFactor = 1 + taxRate / 100;
  const crccFactor = 1 + crccRate / 100;
  const cmccFactor = 1 + cmccRate / 100;

  let rawItems: unknown = quote.items;
  if (typeof rawItems === 'string') {
    try { rawItems = JSON.parse(rawItems); } catch { rawItems = []; }
  }
  const items = Array.isArray(rawItems) ? rawItems as Array<Record<string, unknown>> : [];

  let subtotal = 0;
  let crccTotal = 0;
  let cmccTotal = 0;
  const mapped = items.filter((item) => item && typeof item === 'object').map((item) => {
    const isLabor = item.itemType === 'labor';
    const qty = isLabor ? num(item.laborDays) || num(item.quantity) : num(item.quantity);
    const basePrice = num(item.price);
    const unitPrice = basePrice * (1 + num(quote.management_rate) / 100 + num(quote.profit_rate) / 100 + num(quote.regulatory_rate) / 100);
    const taxUnit = basePrice * taxFactor;
    const crccUnit = basePrice * taxFactor * crccFactor;
    const cmccUnit = basePrice * taxFactor * crccFactor * cmccFactor;
    subtotal += basePrice * qty;
    crccTotal += crccUnit * qty;
    cmccTotal += cmccUnit * qty;
    let displayName = String(item.name ?? '');
    if (isLabor) {
      const levelName = String(item.laborLevelName ?? '人工');
      const desc = item.laborDescription ? `(${String(item.laborDescription)})` : '';
      displayName = levelName + '人工' + desc;
    }
    return {
      name: displayName,
      unit: isLabor ? '人天' : String(item.unit ?? ''),
      quantity: qty,
      unitPrice,
      amount: unitPrice * qty,
      location: String(item.location ?? ''),
      crccUnitPrice: crccUnit,
      cmccUnitPrice: cmccUnit,
      crccAmount: crccUnit * qty,
      cmccAmount: cmccUnit * qty,
    };
  });

  const grandTotal = tierMode ? subtotal * taxFactor : subtotal * (1 + num(quote.management_rate) / 100 + num(quote.profit_rate) / 100 + num(quote.regulatory_rate) / 100) * (1 + taxRate / 100);
  const taxAmount = tierMode ? subtotal * (taxFactor - 1) : (subtotal * (1 + num(quote.management_rate) / 100 + num(quote.profit_rate) / 100 + num(quote.regulatory_rate) / 100)) * taxRate / 100;

  return {
    projectName: quote.project_name,
    clientName: quote.client_name ?? '',
    contactPerson: quote.contact_person ?? '',
    contactPhone: quote.contact_phone ?? '',
    quoteNumber: quote.quote_number,
    quoteDate: new Date(quote.created_at).toISOString().split('T')[0],
    items: mapped,
    rates: {
      managementRate: num(quote.management_rate),
      profitRate: num(quote.profit_rate),
      regulatoryRate: num(quote.regulatory_rate),
      taxRate,
      tierMode,
      tierTaxRate: taxRate,
      crccRate,
      cmccRate,
    },
    summary: {
      subtotal,
      managementFee: num(quote.management_fee),
      profit: num(quote.profit),
      regulatoryFee: num(quote.regulatory_fee),
      tax: taxAmount,
      grandTotal,
      grandTotalRMB: convertToChineseCurrency(grandTotal),
      crccTotal,
      cmccTotal,
    },
  };
}
