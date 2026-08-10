/**
 * 报价资料库：把康海物流模板 xlsx 解析为 quote_data 结构。
 *
 * 注意：此文件依赖 xlsx-js-style，应仅在浏览器或运行 Node + Buffer 的服务端使用。
 */

import * as XLSX from 'xlsx-js-style';

import {
  QUOTE_LIBRARY_TEMPLATE_VERSION,
  type QuoteData,
  type QuoteFloorPoint,
  type QuoteItem,
  type QuoteSummary,
} from './quote-library-types';

interface RawRow {
  [key: number]: unknown;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * 解析「汇总」Sheet 为 QuoteSummary。
 *
 * 约定：
 *   - 第 1 行：表头标题
 *   - 第 2 行：列标题
 *   - 第 3..N-1 行：明细行（最后一行「合计」应跳过）
 *   - 第 N 行：合计行（汇总合计值）
 *   - 第 N+1 行：「说明：」+ 说明文字
 */
export function parseSummarySheet(rows: unknown[][]): QuoteSummary {
  const dataRows = rows.filter((r) => Array.isArray(r) && r.some((c) => toText(c) !== ''));
  const title = dataRows[0]?.[0] ? toText(dataRows[0][0]) : '报价汇总';

  let items: QuoteItem[] = [];
  let totals = {
    taxable_total: 0,
    tiejiang_taxable_total: 0,
    yidong_taxable_total: 0,
  };
  let note: string | undefined;

  // 默认从第 3 行开始是明细（index=2）
  let index = 2;
  // 自动跳过表头标题行 + 列标题行
  while (index < dataRows.length) {
    const row = dataRows[index] ?? [];
    const first = toText(row[0]);
    if (first === '合计') {
      totals = {
        taxable_total: toNumber(row[8]),
        tiejiang_taxable_total: toNumber(row[9]),
        yidong_taxable_total: toNumber(row[10]),
      };
      index += 1;
      // 后续若有「说明：」行
      while (index < dataRows.length) {
        const noteRow = dataRows[index] ?? [];
        const t = toText(noteRow[0]);
        if (t.startsWith('说明')) {
          note = (t + ' ' + noteRow.slice(1).map(toText).filter(Boolean).join(' ')).trim();
        }
        index += 1;
      }
      break;
    }
    if (!first) {
      index += 1;
      continue;
    }
    items.push({
      name: first,
      spec: toText(row[1]),
      unit: toText(row[2]),
      quantity: toNumber(row[3]),
      unit_price: toNumber(row[4]),
      taxable_unit_price: toNumber(row[5]),
      tiejiang_taxable_unit_price: toNumber(row[6]),
      yidong_taxable_unit_price: toNumber(row[7]),
      total_taxable: toNumber(row[8]),
      tiejiang_total: toNumber(row[9]),
      yidong_total: toNumber(row[10]),
      remark: toText(row[11]),
    });
    index += 1;
  }

  return { title, items, totals, note };
}

/**
 * 解析「Sheet2」点位表为可选的 floors。
 *
 * 数据格式（来自康海模板）：
 *   - 第 1 行：列标题（前面为空，"网线" 列、"PVC" 列等）
 *   - 第 2..N-3 行：每行一个楼层，后三列为 AP 信息
 */
export function parsePointsSheet(rows: unknown[][]): QuoteFloorPoint[] {
  const dataRows = rows.filter((r) => Array.isArray(r) && r.some((c) => toText(c) !== ''));
  const floors: QuoteFloorPoint[] = [];
  for (const row of dataRows) {
    const first = toText(row[0]);
    if (!first || first === '网线' || first === 'PVC') continue;
    // 跳过纯数字合计行
    const isAllNumbers = row.slice(1).every((v) => v === '' || Number.isFinite(Number(v)));
    if (isAllNumbers && first) {
      const counts: number[] = [];
      for (let i = 1; i < row.length; i += 1) {
        const cell = toText(row[i]);
        if (cell === '') continue;
        // AP 列以非数字开头（如 "AP1"），跳过该列数字
        if (/^[A-Za-z]/.test(cell)) break;
        counts.push(toNumber(cell));
      }
      const apText = row
        .map((v) => toText(v))
        .filter((t) => /^[A-Za-z]/.test(t) || /^\d+(\.\d+)?$/.test(t) === false)
        .filter(Boolean)
        .join(' ');
      floors.push({
        name: first,
        counts,
        ap: apText && !/^\d+(\.\d+)?$/.test(apText.split(' ')[0] ?? '') ? apText : undefined,
      });
    }
  }
  return floors;
}

/**
 * 把 xlsx ArrayBuffer 解析为完整的 QuoteData。
 */
export function parseQuoteTemplate(buffer: ArrayBuffer): QuoteData {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const summarySheet = workbook.Sheets['汇总'] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!summarySheet) {
    throw new Error('未找到「汇总」工作表');
  }
  const summaryRows = XLSX.utils.sheet_to_json<RawRow>(summarySheet, {
    header: 1,
    raw: true,
    defval: '',
  }) as unknown[][];
  const summary = parseSummarySheet(summaryRows);

  const summaryTotal = summary.totals.taxable_total;

  let points: { floors: QuoteFloorPoint[] } | undefined;
  const pointsSheet = workbook.Sheets['Sheet2'] ?? workbook.Sheets[1];
  if (pointsSheet) {
    const pointsRows = XLSX.utils.sheet_to_json<RawRow>(pointsSheet, {
      header: 1,
      raw: true,
      defval: '',
    }) as unknown[][];
    const parsed = parsePointsSheet(pointsRows);
    if (parsed.length > 0) points = { floors: parsed };
  }

  return {
    template: QUOTE_LIBRARY_TEMPLATE_VERSION,
    summary,
    points,
    // 兼容字段：使用 totals 中的含税合计作为顶层冗余
    ...({ total_amount: summaryTotal } as Record<string, number>),
  } as QuoteData;
}

/**
 * 把 quote_data 渲染回 xlsx ArrayBuffer，沿用模板表头。
 *
 * 客户端和服务端均可调用（xlsx-js-style 不依赖 Node 内置模块）。
 */
export function renderQuoteDataToWorkbook(data: QuoteData): XLSX.WorkBook {
  const aoa: unknown[][] = [];

  aoa.push([data.summary.title, '', '', '', '', '', '', '', '', '', '', '']);
  aoa.push([
    '项目名称',
    '规格/型号/参数',
    '单位',
    '数量',
    '单价',
    '含税单价（6%）',
    '铁建含税单价（管理费6%）',
    '移动含税单价（管理费8%）',
    '总价含税(含税单价×数量)',
    '铁建总价（铁建含税单价×数量）',
    '移动总价（移动含税单价×数量）',
    '备注',
  ]);

  for (const item of data.summary.items) {
    aoa.push([
      item.name,
      item.spec ?? '',
      item.unit ?? '',
      item.quantity,
      item.unit_price,
      item.taxable_unit_price ?? '',
      item.tiejiang_taxable_unit_price ?? '',
      item.yidong_taxable_unit_price ?? '',
      item.total_taxable ?? '',
      item.tiejiang_total ?? '',
      item.yidong_total ?? '',
      item.remark ?? '',
    ]);
  }

  aoa.push([
    '合计',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    data.summary.totals.taxable_total,
    data.summary.totals.tiejiang_taxable_total,
    data.summary.totals.yidong_taxable_total,
    '',
  ]);

  if (data.summary.note) aoa.push(['说明：', data.summary.note, '', '', '', '', '', '', '', '', '', '']);

  const summarySheet = XLSX.utils.aoa_to_sheet(aoa);
  applyQuoteSheetStyle(summarySheet);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总');

  if (data.points && data.points.floors.length > 0) {
    const pointsAoa: unknown[][] = [];
    // 表头（保留首行的"网线 PVC"风格作为占位列）
    const maxCounts = Math.max(0, ...data.points.floors.map((f) => f.counts.length));
    const header = new Array(maxCounts + 4).fill('');
    header[maxCounts] = '网线';
    header[maxCounts + 1] = 'PVC';
    pointsAoa.push(header);
    for (const floor of data.points.floors) {
      pointsAoa.push([
        floor.name,
        ...floor.counts,
        ...new Array(Math.max(0, maxCounts - floor.counts.length)).fill(''),
        '',
        floor.ap ?? '',
      ]);
    }
    const pointsSheet = XLSX.utils.aoa_to_sheet(pointsAoa);
    XLSX.utils.book_append_sheet(workbook, pointsSheet, 'Sheet2');
  }

  return workbook;
}

const HEADER_FILL = { patternType: 'solid', fgColor: { rgb: 'FF1E40AF' } } as const;
const HEADER_FONT = { bold: true, color: { rgb: 'FFFFFFFF' } } as const;
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { rgb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { rgb: 'FFCBD5E1' } },
} as const;

function applyQuoteSheetStyle(sheet: XLSX.WorkSheet): void {
  const ref = sheet['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (!cell) continue;
      cell.s = cell.s ?? {};
      (cell.s as Record<string, unknown>).border = THIN_BORDER;
      if (r === 1) {
        (cell.s as Record<string, unknown>).fill = HEADER_FILL;
        (cell.s as Record<string, unknown>).font = HEADER_FONT;
        (cell.s as Record<string, unknown>).alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
      }
    }
  }
  sheet['!cols'] = [
    { wch: 22 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
  ];
}

/** 计算含税合计的便捷方法（前端展示用） */
export function computeTaxableTotal(items: QuoteItem[]): number {
  return items.reduce((sum, it) => sum + (Number(it.total_taxable) || (Number(it.taxable_unit_price) || Number(it.unit_price) || 0) * (Number(it.quantity) || 0)), 0);
}