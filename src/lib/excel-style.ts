/**
 * 共享 Excel 导出样式工具。
 *
 * 统一的商务风样式：深蓝表头(#1e3a8a)白字加粗、斑马纹隔行、全边框、金额右对齐带千分位、
 * 合计行加粗浅黄背景、标题居中合并。所有导出 Excel 的功能复用此模块，保证风格一致。
 */

import * as XLSX from 'xlsx-js-style';

// ===== 基础样式常量 =====
export const HEADER_FILL = { fgColor: { rgb: '1e3a8a' } };
export const HEADER_FONT = { bold: true, color: { rgb: 'ffffff' }, sz: 11 };
export const TITLE_FONT = { bold: true, sz: 16, color: { rgb: '1e3a8a' } };
export const BORDER_ALL = {
  top: { style: 'thin' as const, color: { rgb: 'c0c4cc' } },
  bottom: { style: 'thin' as const, color: { rgb: 'c0c4cc' } },
  left: { style: 'thin' as const, color: { rgb: 'c0c4cc' } },
  right: { style: 'thin' as const, color: { rgb: 'c0c4cc' } },
};
export const ZEBRA_FILL = { fgColor: { rgb: 'f4f6fb' } };
export const TOTAL_FILL = { fgColor: { rgb: 'fff3cd' } };
export const TOTAL_FONT = { bold: true };

export const MONEY_FMT = '¥#,##0.00';
export const CENTER = { horizontal: 'center' as const, vertical: 'center' as const };
export const RIGHT = { horizontal: 'right' as const, vertical: 'center' as const };

export type CellStyle = XLSX.CellObject['s'];

export interface HeaderSpec { title: string; width: number }

/** 建一个空 sheet 并设置列宽 */
export function newSheet(headers: HeaderSpec[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  ws['!cols'] = headers.map((h) => ({ wch: h.width }));
  return ws;
}

/** 写单元格 */
export function put(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string | number,
  style?: CellStyle,
): void {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const type = typeof value === 'number' ? 'n' : 's';
  ws[addr] = { t: type, v: value, ...(style ? { s: style } : {}) };
}

/** 合并单元格 */
export function merge(ws: XLSX.WorkSheet, s: { r: number; c: number }, e: { r: number; c: number }): void {
  if (!ws['!merges']) ws['!merges'] = [];
  (ws['!merges'] as XLSX.Range[]).push({ s, e });
}

/** 写表格：表头一行 + 数据行（斑马纹），返回写到的下一行 index */
export function writeTable(
  ws: XLSX.WorkSheet,
  startRow: number,
  headers: HeaderSpec[],
  rows: Array<Array<string | number>>,
  opts: { moneyCols?: number[]; totalRow?: Array<string | number> } = {},
): number {
  // 表头
  headers.forEach((h, i) => {
    put(ws, startRow, i, h.title, {
      fill: HEADER_FILL,
      font: HEADER_FONT,
      alignment: CENTER,
      border: BORDER_ALL,
    });
  });

  // 数据行
  rows.forEach((row, r) => {
    const actualRow = startRow + 1 + r;
    row.forEach((val, c) => {
      const style: CellStyle = {
        border: BORDER_ALL,
        alignment: opts.moneyCols?.includes(c) ? RIGHT : CENTER,
        ...(r % 2 === 1 ? { fill: ZEBRA_FILL } : {}),
        ...(opts.moneyCols?.includes(c) && typeof val === 'number' ? { numFmt: MONEY_FMT } : {}),
      };
      put(ws, actualRow, c, val, style);
    });
  });

  let nextRow = startRow + 1 + rows.length;

  // 合计行
  if (opts.totalRow) {
    opts.totalRow.forEach((val, c) => {
      const style: CellStyle = {
        fill: TOTAL_FILL,
        font: TOTAL_FONT,
        border: BORDER_ALL,
        alignment: opts.moneyCols?.includes(c) ? RIGHT : CENTER,
        ...(opts.moneyCols?.includes(c) && typeof val === 'number' ? { numFmt: MONEY_FMT } : {}),
      };
      put(ws, nextRow, c, val, style);
    });
    nextRow += 1;
  }

  return nextRow;
}
