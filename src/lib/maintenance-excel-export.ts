/**
 * 维保报价 Excel 多 Sheet 美化导出。
 *
 * 输出 6 个 Sheet：报价总览 / 设备清单 / 设备报价明细 / 费用汇总 / 按次服务项 / 分地区报价。
 * 样式复用 excel-style 共享层（深蓝表头、斑马纹、边框、金额千分位、合计加粗、标题居中合并）。
 */

import * as XLSX from 'xlsx-js-style';
import {
  newSheet,
  put,
  merge,
  writeTable,
  HEADER_FILL,
  HEADER_FONT,
  TITLE_FONT,
  BORDER_ALL,
  ZEBRA_FILL,
  TOTAL_FILL,
  TOTAL_FONT,
  MONEY_FMT,
  CENTER,
  RIGHT,
  type CellStyle,
  type HeaderSpec,
} from './excel-style';

/** 与页面 handleExportExcel 组装好的输入数据 */
export interface MaintenanceExcelInput {
  info: {
    projectName: string;
    clientName: string;
    contactPerson: string;
    contactPhone: string;
    quoteNumber: string;
    quoteDate: string;
    engineerLevel: string;
    region: string;
    contractYears: number;
    equipmentCount: number;
    serviceCount: number;
    grandTotal: number;
    grandTotalRMB: string;
  };
  devices: Array<{
    name: string;
    model: string;
    category: string;
    quantity: number;
    depreciationLevel: string;
    deviceGrade: string;
    inWarranty: boolean;
    needSparePart: boolean;
    contractYears: number;
    slaText: string;
    subtotal: number;
  }>;
  quoteItems: Array<{
    name: string;
    depreciationLevel: string;
    deviceGrade: string;
    quantity: number;
    inspectionFee: number;
    onSiteFee: number;
    faultHandlingFee: number;
    toolAmortization: number;
    consumableFee: number;
    sparePartReserve: number;
    unitPrice: number;
    subtotal: number;
  }>;
  summary: {
    totalInspection: number;
    totalOnsite: number;
    totalRepair: number;
    totalTools: number;
    totalConsumables: number;
    totalSpareParts: number;
    subtotalBeforeDiscount: number;
    subtotalAfterDiscount: number;
    bulkDiscountAmount: number;
    subtotal: number;
    serviceYearTotal: number;
    serviceTotal: number;
    tax: number;
    grandTotal: number;
  };
  serviceItems: Array<{
    name: string;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    timesPerYear: number;
    settledByActual: boolean;
    yearCost: number;
    totalCost: number;
  }>;
  regions: Array<{ region: string; factor: number; subtotal: number; tax: number; total: number }>;
  yearly: Array<{ year: string; total: number }>;
}

/** 主构建函数：输入组装好的数据，返回 workbook */
export function buildMaintenanceWorkbook(input: MaintenanceExcelInput): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const { info, devices, quoteItems, summary, serviceItems, regions, yearly } = input;

  // ===== Sheet 1: 报价总览 =====
  {
    const headers: HeaderSpec[] = [
      { title: '项目', width: 16 },
      { title: '内容', width: 22 },
      { title: '项目', width: 16 },
      { title: '内容', width: 22 },
    ];
    const ws = newSheet(headers);
    // 标题
    merge(ws, { r: 0, c: 0 }, { r: 0, c: 3 });
    put(ws, 0, 0, '设备维保服务报价单', { font: TITLE_FONT, alignment: CENTER });
    ws['!rows'] = [{ hpt: 34 }];

    const infoRows: Array<[string, string, string, string]> = [
      ['项目名称', info.projectName || '-', '报价单号', info.quoteNumber || '-'],
      ['客户单位', info.clientName || '-', '报价日期', info.quoteDate || '-'],
      ['联系人', info.contactPerson || '-', '联系电话', info.contactPhone || '-'],
      ['服务区域', info.region || '-', '工程师等级', info.engineerLevel || '-'],
      ['服务期限', `${info.contractYears}年`, '设备数量', `${info.equipmentCount}台`],
      ['按次服务项', `${info.serviceCount}项`, '报价总计', `¥${info.grandTotal.toFixed(2)}`],
    ];
    infoRows.forEach((row, r) => {
      const actualRow = 2 + r;
      row.forEach((val, c) => {
        put(ws, actualRow, c, val, {
          border: BORDER_ALL,
          font: c % 2 === 0 ? { bold: true } : undefined,
          alignment: c % 2 === 0 ? CENTER : { horizontal: 'left', vertical: 'center' },
          ...(c === 3 && val.includes('¥') ? { fill: TOTAL_FILL, font: { bold: true } } : {}),
        });
      });
    });

    // 大写金额
    put(ws, 9, 0, '大写金额', { font: { bold: true }, border: BORDER_ALL, alignment: CENTER });
    merge(ws, { r: 9, c: 1 }, { r: 9, c: 3 });
    put(ws, 9, 1, info.grandTotalRMB || '-', { border: BORDER_ALL, alignment: { horizontal: 'left', vertical: 'center' } });

    // SLA 参数说明
    const slaLines: Array<[string, string]> = [
      ['SLA 服务参数', ''],
      ['服务时间', '7×24（按合同约定）'],
      ['响应时间', '30分钟'],
      ['到场时间', '8小时'],
      ['支持方式', '远程+现场'],
    ];
    slaLines.forEach((line, r) => {
      const actualRow = 11 + r;
      put(ws, actualRow, 0, line[0], { border: BORDER_ALL, font: { bold: true }, alignment: CENTER });
      merge(ws, { r: actualRow, c: 1 }, { r: actualRow, c: 3 });
      put(ws, actualRow, 1, line[1], { border: BORDER_ALL, alignment: { horizontal: 'left', vertical: 'center' } });
    });

    XLSX.utils.book_append_sheet(wb, ws, '报价总览');
  }

  // ===== Sheet 2: 设备清单 =====
  {
    const headers: HeaderSpec[] = [
      { title: '序号', width: 6 },
      { title: '设备名称', width: 24 },
      { title: '规格型号', width: 20 },
      { title: '设备分类', width: 14 },
      { title: '数量', width: 8 },
      { title: '成新率', width: 10 },
      { title: '设备分档', width: 10 },
      { title: '在保状态', width: 10 },
      { title: '需要备件', width: 10 },
      { title: '合同年限', width: 10 },
      { title: 'SLA 配置', width: 18 },
      { title: '小计（元）', width: 14 },
    ];
    const ws = newSheet(headers);
    const rows = devices.map((d, i) => [
      i + 1,
      d.name,
      d.model,
      d.category,
      d.quantity,
      d.depreciationLevel,
      d.deviceGrade,
      d.inWarranty ? '在保' : '过保',
      d.needSparePart ? '是' : '否',
      `${d.contractYears}年`,
      d.slaText,
      d.subtotal,
    ]);
    writeTable(ws, 0, headers, rows, {
      moneyCols: [11],
      totalRow: ['', '合计', '', '', devices.reduce((s, d) => s + d.quantity, 0), '', '', '', '', '', '', devices.reduce((s, d) => s + d.subtotal, 0)],
    });
    XLSX.utils.book_append_sheet(wb, ws, '设备清单');
  }

  // ===== Sheet 3: 设备报价明细 =====
  {
    const headers: HeaderSpec[] = [
      { title: '序号', width: 6 },
      { title: '设备名称', width: 22 },
      { title: '成新率', width: 10 },
      { title: '设备分档', width: 10 },
      { title: '数量', width: 8 },
      { title: '巡检费', width: 12 },
      { title: '上门费', width: 12 },
      { title: '故障处理费', width: 13 },
      { title: '工具仪表摊销', width: 14 },
      { title: '耗材费', width: 12 },
      { title: '备件准备金', width: 13 },
      { title: '单价（城区）', width: 13 },
      { title: '小计（城区）', width: 14 },
    ];
    const ws = newSheet(headers);
    const rows = quoteItems.map((q, i) => [
      i + 1,
      q.name,
      q.depreciationLevel,
      q.deviceGrade,
      q.quantity,
      q.inspectionFee,
      q.onSiteFee,
      q.faultHandlingFee,
      q.toolAmortization,
      q.consumableFee,
      q.sparePartReserve,
      q.unitPrice,
      q.subtotal,
    ]);
    const sum = (k: 'inspectionFee' | 'onSiteFee' | 'faultHandlingFee' | 'toolAmortization' | 'consumableFee' | 'sparePartReserve' | 'subtotal') =>
      quoteItems.reduce((s, q) => s + q[k], 0);
    writeTable(ws, 0, headers, rows, {
      moneyCols: [5, 6, 7, 8, 9, 10, 11, 12],
      totalRow: ['', '合计', '', '', '', sum('inspectionFee'), sum('onSiteFee'), sum('faultHandlingFee'), sum('toolAmortization'), sum('consumableFee'), sum('sparePartReserve'), '', sum('subtotal')],
    });
    XLSX.utils.book_append_sheet(wb, ws, '设备报价明细');
  }

  // ===== Sheet 4: 费用汇总 =====
  {
    const headers: HeaderSpec[] = [
      { title: '费用项目', width: 22 },
      { title: '金额（元）', width: 18 },
    ];
    const ws = newSheet(headers);
    const rows: Array<Array<string | number>> = [
      ['巡检费合计', summary.totalInspection],
      ['上门费合计', summary.totalOnsite],
      ['故障处理费合计', summary.totalRepair],
      ['工具仪表摊销', summary.totalTools],
      ['耗材费合计', summary.totalConsumables],
      ['备件风险准备金', summary.totalSpareParts],
      ['小计（折扣前）', summary.subtotalBeforeDiscount],
      ['批量优惠', -summary.bulkDiscountAmount],
      ['小计（折扣后）', summary.subtotalAfterDiscount],
    ];
    if (serviceItems.length > 0) {
      rows.push(['按次服务项年费用', summary.serviceYearTotal]);
      rows.push(['按次服务项总额（不含税）', summary.serviceTotal]);
    }
    rows.push(['增值税（13%）', summary.tax]);
    writeTable(ws, 0, headers, rows, {
      moneyCols: [1],
      totalRow: ['报价总计', summary.grandTotal],
    });
    XLSX.utils.book_append_sheet(wb, ws, '费用汇总');
  }

  // ===== Sheet 5: 按次服务项 =====
  if (serviceItems.length > 0) {
    const headers: HeaderSpec[] = [
      { title: '序号', width: 6 },
      { title: '服务类型', width: 18 },
      { title: '服务内容', width: 34 },
      { title: '数量', width: 8 },
      { title: '单位', width: 8 },
      { title: '单价（元）', width: 12 },
      { title: '年预估次数', width: 12 },
      { title: '按实结算', width: 10 },
      { title: '年费用（元）', width: 14 },
      { title: `${info.contractYears}年总额（元）`, width: 16 },
    ];
    const ws = newSheet(headers);
    const rows = serviceItems.map((s, i) => [
      i + 1,
      s.name || '-',
      s.description || '-',
      s.quantity,
      s.unit,
      s.settledByActual ? '按实结算' : s.unitPrice,
      s.settledByActual ? '—' : s.timesPerYear,
      s.settledByActual ? '是' : '否',
      s.settledByActual ? '按实结算' : s.yearCost,
      s.settledByActual ? '按实结算' : s.totalCost,
    ]);
    writeTable(ws, 0, headers, rows, {
      moneyCols: [5, 8, 9],
      totalRow: ['', '合计', '', '', '', '', '', '', serviceItems.reduce((sum, s) => sum + s.yearCost, 0), serviceItems.reduce((sum, s) => sum + s.totalCost, 0)],
    });
    XLSX.utils.book_append_sheet(wb, ws, '按次服务项');
  }

  // ===== Sheet 6: 分地区报价 =====
  if (regions.length > 0) {
    const headers: HeaderSpec[] = [
      { title: '地区', width: 16 },
      { title: '地区系数', width: 10 },
      { title: '不含税小计', width: 14 },
      { title: '税额', width: 14 },
      { title: '含税总价', width: 16 },
    ];
    const ws = newSheet(headers);
    const rows = regions.map((r) => [r.region, r.factor, r.subtotal, r.tax, r.total]);
    const totalRow: Array<string | number> = ['', '', '', '', ''];
    // 各年总价追加为数据行
    const yearlyRows: Array<Array<string | number>> = [];
    yearly.forEach((y) => {
      yearlyRows.push([y.year, '', '', '', y.total]);
    });
    const nextRow = writeTable(ws, 0, headers, rows, { moneyCols: [2, 3, 4] });
    yearlyRows.forEach((yr, i) => {
      yr.forEach((val, c) => {
        put(ws, nextRow + i, c, val, {
          border: BORDER_ALL,
          alignment: c === 0 ? CENTER : RIGHT,
          font: c === 0 ? { bold: true } : undefined,
          ...(typeof val === 'number' ? { numFmt: MONEY_FMT } : {}),
        });
      });
    });
    void totalRow;
    XLSX.utils.book_append_sheet(wb, ws, '分地区报价');
  }

  return wb;
}
