import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx-js-style';

import { buildMaintenanceWorkbook, type MaintenanceExcelInput } from '../src/lib/maintenance-excel-export';

function sampleInput(overrides: Partial<MaintenanceExcelInput> = {}): MaintenanceExcelInput {
  return {
    info: {
      projectName: '宁德市信息中心数据灾备中心改造项目',
      clientName: '宁德市信息中心',
      contactPerson: '张三',
      contactPhone: '13800000000',
      quoteNumber: 'WB20260814001',
      quoteDate: '2026-08-14',
      engineerLevel: '中级',
      region: '城区',
      contractYears: 3,
      equipmentCount: 16,
      serviceCount: 1,
      grandTotal: 382560,
      grandTotalRMB: '叁拾捌万贰仟伍佰陆拾元整',
    },
    devices: [
      { name: '精密空调', model: 'NetCol5000-A025', category: '机房环境设备', quantity: 16, depreciationLevel: '一般', deviceGrade: 'A', inWarranty: true, needSparePart: true, contractYears: 3, slaText: '有经验 / 远程+现场', subtotal: 7420 * 16 },
    ],
    quoteItems: [
      { name: '精密空调', depreciationLevel: '一般', deviceGrade: 'A', quantity: 16, inspectionFee: 200, onSiteFee: 100, faultHandlingFee: 300, toolAmortization: 50, consumableFee: 30, sparePartReserve: 200, unitPrice: 7420, subtotal: 7420 * 16 },
    ],
    summary: {
      totalInspection: 3200,
      totalOnsite: 1600,
      totalRepair: 4800,
      totalTools: 800,
      totalConsumables: 480,
      totalSpareParts: 3200,
      subtotalBeforeDiscount: 118720,
      subtotalAfterDiscount: 118720,
      bulkDiscountAmount: 0,
      subtotal: 145120,
      serviceYearTotal: 8800,
      serviceTotal: 26400,
      tax: 15433.6,
      grandTotal: 382560,
    },
    serviceItems: [
      { name: '例行巡检', description: '季度巡检', unit: '项', quantity: 1, unitPrice: 2200, timesPerYear: 4, settledByActual: false, yearCost: 8800, totalCost: 26400 },
    ],
    regions: [
      { region: '城区', factor: 1, subtotal: 118720, tax: 15433.6, total: 134153.6 },
      { region: '市区县城郊区', factor: 1.05, subtotal: 124656, tax: 16205.28, total: 140861.28 },
    ],
    yearly: [
      { year: '第一年', total: 134153.6 },
      { year: '第二年', total: 127445.92 },
      { year: '第三年', total: 120738.24 },
    ],
    ...overrides,
  };
}

test('buildMaintenanceWorkbook 生成 6 个 Sheet', () => {
  const wb = buildMaintenanceWorkbook(sampleInput());
  const names = wb.SheetNames;
  assert.ok(names.includes('报价总览'));
  assert.ok(names.includes('设备清单'));
  assert.ok(names.includes('设备报价明细'));
  assert.ok(names.includes('费用汇总'));
  assert.ok(names.includes('按次服务项'));
  assert.ok(names.includes('分地区报价'));
});

test('buildMaintenanceWorkbook 无服务项时不含按次服务项 sheet', () => {
  const wb = buildMaintenanceWorkbook(sampleInput({ serviceItems: [], info: { ...sampleInput().info, serviceCount: 0 }, summary: { ...sampleInput().summary, serviceYearTotal: 0, serviceTotal: 0 } }));
  assert.ok(!wb.SheetNames.includes('按次服务项'));
});

test('buildMaintenanceWorkbook 设备清单含表头与数据、金额为数字', () => {
  const wb = buildMaintenanceWorkbook(sampleInput());
  const ws = wb.Sheets['设备清单'];
  assert.ok(ws, '设备清单 sheet 存在');
  // 表头第一行
  const a1 = ws['A1'];
  assert.equal(a1?.v, '序号');
  // 数据行：B2 是设备名称
  const b2 = ws['B2'];
  assert.equal(b2?.v, '精密空调');
  // 合计行：L2 金额为数字
  const l2 = ws['L2'];
  assert.equal(typeof l2?.v, 'number');
  // 表头有深蓝填充样式
  const a1Style = a1?.s as { fill?: { fgColor?: { rgb?: string } } } | undefined;
  assert.equal(a1Style?.fill?.fgColor?.rgb, '1e3a8a');
});

test('buildMaintenanceWorkbook 服务项 sheet 金额为数字并含合计', () => {
  const wb = buildMaintenanceWorkbook(sampleInput());
  const ws = wb.Sheets['按次服务项'];
  assert.ok(ws);
  const a1 = ws['A1'];
  assert.equal(a1?.v, '序号');
  // 数据行：B2 服务类型
  const b2 = ws['B2'];
  assert.equal(b2?.v, '例行巡检');
  // 合计行 I3 年费用合计 = 8800
  const i3 = ws['I3'];
  assert.equal(i3?.v, 8800);
  // 合计行 J3 总额 = 26400
  const j3 = ws['J3'];
  assert.equal(j3?.v, 26400);
});
