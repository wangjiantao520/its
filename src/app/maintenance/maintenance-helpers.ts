/**
 * 维保报价页面的纯函数与常量
 *
 * 从 maintenance/page.tsx 抽取，不依赖 React state，
 * 可独立测试与复用。page.tsx 仅保留组件渲染与状态管理。
 */

import * as XLSX from 'xlsx-js-style';
import { newSheet, put, merge, HEADER_FILL, HEADER_FONT, TITLE_FONT, CENTER, RIGHT, BORDER_ALL, ZEBRA_FILL, MONEY_FMT } from '@/lib/excel-style';
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

  // 纵向键值对：['项目', '数值']，空项目名表示分隔行
  const summaryRows: Array<[string, string]> = [
    ['报价单号', `WB${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`],
    ['项目名称', projectName || '-'],
    ['客户名称', clientName || '-'],
    ['设备数量', `${selectedDevices.reduce((s, d) => s + d.quantity, 0)} 台`],
    ['服务区域', region],
    ['合同年限', `${contractYears} 年`],
    ['', ''],
    ['维保报价（不含税）', (fullQuoteResult?.subtotalAfterDiscount ?? quoteResult?.subtotal ?? 0).toLocaleString()],
    ['增值税（13%）', (fullQuoteResult?.taxAmount ?? quoteResult?.taxAmount ?? 0).toLocaleString()],
    ['含税总价', grandTotal.toLocaleString()],
    ['', ''],
    ['维保成本', maintenanceCost.toLocaleString()],
    ['维保利润', maintenanceProfit.toLocaleString()],
    ['成本率', `${costRatio}%`],
    ['利润率', `${100 - costRatio}%`],
  ];

  const wb = XLSX.utils.book_new();
  const ws = newSheet([{ title: '项目', width: 25 }, { title: '数值', width: 35 }]);
  // 标题
  merge(ws, { r: 0, c: 0 }, { r: 0, c: 1 });
  put(ws, 0, 0, '维保报价汇总', { font: TITLE_FONT, alignment: CENTER });
  ws['!rows'] = [{ hpt: 30 }];
  // 表头
  put(ws, 1, 0, '项目', { fill: HEADER_FILL, font: HEADER_FONT, alignment: CENTER, border: BORDER_ALL });
  put(ws, 1, 1, '数值', { fill: HEADER_FILL, font: HEADER_FONT, alignment: CENTER, border: BORDER_ALL });

  let isMoneySection = false;
  summaryRows.forEach(([label, value], i) => {
    const r = i + 2;
    if (label === '') {
      // 分隔行（浅底）
      put(ws, r, 0, '', { border: BORDER_ALL });
      put(ws, r, 1, '', { border: BORDER_ALL });
      isMoneySection = i > 6;
      return;
    }
    const isTotal = label === '含税总价' || label === '维保利润';
    const style = {
      border: BORDER_ALL,
      fill: isTotal ? { fgColor: { rgb: 'fff3cd' } } : (i % 2 === 1 ? ZEBRA_FILL : undefined),
      font: isTotal ? { bold: true } : undefined,
    };
    put(ws, r, 0, label, { ...style, alignment: CENTER });
    // 金额区（维保报价/增值税/含税总价/成本/利润）右对齐带千分位
    const numericValue = !Number.isNaN(Number(value.replace(/,/g, '')));
    if (isMoneySection && numericValue) {
      put(ws, r, 1, Number(value.replace(/,/g, '')), { ...style, numFmt: MONEY_FMT, alignment: RIGHT });
    } else {
      put(ws, r, 1, value, { ...style, alignment: { horizontal: 'left', vertical: 'center' } });
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, '报价汇总');
  XLSX.writeFile(wb, `维保报价汇总_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
