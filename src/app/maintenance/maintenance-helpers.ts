/**
 * 维保报价页面的纯函数与常量
 *
 * 从 maintenance/page.tsx 抽取，不依赖 React state，
 * 可独立测试与复用。page.tsx 仅保留组件渲染与状态管理。
 */

import * as XLSX from 'xlsx-js-style';
import type { DepreciationLevel, RegionType } from '@/lib/device-quota-full';
import type { FullMaintenanceQuoteResult } from '@/lib/maintenance-calculator-full';
import type { MaintenanceQuoteResult } from '@/lib/maintenance-quota';

/** 成新率等级映射：1级=全新，2级=较新，3级=一般，4级=偏旧，5级=老旧 */
export const DEPRECIATION_GRADE_MAP: Record<string, DepreciationLevel> = {
  '1': '全新',
  '2': '较新',
  '3': '一般',
  '4': '偏旧',
  '5': '老旧',
};

/** 成新率等级反向映射 */
export const DEPRECIATION_LEVEL_TO_GRADE: Record<DepreciationLevel, string> = {
  '全新': '1',
  '较新': '2',
  '一般': '3',
  '偏旧': '4',
  '老旧': '5',
};

/** 汇总 Excel 导出参数 */
export interface ExportSummaryParams {
  fullQuoteResult: FullMaintenanceQuoteResult | null;
  quoteResult: MaintenanceQuoteResult | null;
  contractYears: string;
  costRatio: number;
  projectName: string;
  clientName: string;
  region: RegionType;
  /** 仅用到 quantity 字段，用最小类型解耦 */
  selectedDevices: Array<{ quantity: number }>;
}

/**
 * 汇总格式导出 Excel（单页汇总表）
 * 从 page.tsx 抽取为纯函数，所有依赖通过参数传入。
 */
export function exportSummaryExcel(params: ExportSummaryParams): void {
  const {
    fullQuoteResult,
    quoteResult,
    contractYears,
    costRatio,
    projectName,
    clientName,
    region,
    selectedDevices,
  } = params;

  const years = parseInt(contractYears) as 1 | 2 | 3;
  const grandTotal = fullQuoteResult
    ? fullQuoteResult.totalByYear[years]
    : (quoteResult?.totalByYear[years] ?? 0);
  const costRatioVal = costRatio / 100;
  const maintenanceCost = grandTotal * costRatioVal;
  const maintenanceProfit = grandTotal - maintenanceCost;

  const summaryData = [
    { '项目': '报价单号', '数值': `WB${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}` },
    { '项目': '项目名称', '数值': projectName || '-' },
    { '项目': '客户名称', '数值': clientName || '-' },
    { '项目': '设备数量', '数值': `${selectedDevices.reduce((s, d) => s + d.quantity, 0)} 台` },
    { '项目': '服务区域', '数值': region },
    { '项目': '合同年限', '数值': `${contractYears} 年` },
    { '项目': '', '数值': '' },
    { '项目': '维保报价（不含税）', '数值': `¥${(fullQuoteResult?.subtotalAfterDiscount ?? quoteResult?.subtotal ?? 0).toLocaleString()}` },
    { '项目': '增值税（13%）', '数值': `¥${(fullQuoteResult?.taxAmount ?? quoteResult?.taxAmount ?? 0).toLocaleString()}` },
    { '项目': '含税总价', '数值': `¥${grandTotal.toLocaleString()}` },
    { '项目': '', '数值': '' },
    { '项目': '维保成本', '数值': `¥${maintenanceCost.toLocaleString()}` },
    { '项目': '维保利润', '数值': `¥${maintenanceProfit.toLocaleString()}` },
    { '项目': '成本率', '数值': `${costRatio}%` },
    { '项目': '利润率', '数值': `${100 - costRatio}%` },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(summaryData);
  ws['!cols'] = [{ wch: 25 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws, '报价汇总');
  XLSX.writeFile(wb, `维保报价汇总_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
