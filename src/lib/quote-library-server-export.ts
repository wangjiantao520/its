/**
 * 报价资料库服务端 Excel 导出工具。
 *
 * 复用 quote-library-template 的 renderQuoteDataToWorkbook（xlsx-js-style，深蓝表头/边框/列宽），
 * 服务端与浏览器导出风格一致。
 */

import * as XLSX from 'xlsx-js-style';

import type { QuoteData } from './quote-library-types';
import { renderQuoteDataToWorkbook } from './quote-library-template';

export function dataToWorkbookBuffer(data: QuoteData): Buffer {
  const workbook = renderQuoteDataToWorkbook(data);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 把原始 xlsx buffer 解析为 quote_data。
 * 服务端使用 `xlsx` 包解析。
 */
export function parseWorkbookBufferToQuoteData(buffer: ArrayBuffer | Buffer): QuoteData {
  const workbook = XLSX.read(buffer as ArrayBuffer, { type: 'array' });
  const summarySheet = workbook.Sheets['汇总'] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!summarySheet) throw new Error('未找到「汇总」工作表');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(summarySheet, { header: 1, raw: true, defval: '' }) as unknown[][];
  const summaryRows = rows.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));

  const title = summaryRows[0]?.[0] ? String(summaryRows[0][0]).trim() : '报价汇总';

  function num(v: unknown): number {
    if (v === null || v === undefined || v === '') return 0;
    const parsed = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function txt(v: unknown): string {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  const items: QuoteData['summary']['items'] = [];
  let totals = { taxable_total: 0, tiejiang_taxable_total: 0, yidong_taxable_total: 0 };
  let note: string | undefined;

  let i = 2;
  while (i < summaryRows.length) {
    const row = summaryRows[i] ?? [];
    const first = txt(row[0]);
    if (first === '合计') {
      totals = {
        taxable_total: num(row[8]),
        tiejiang_taxable_total: num(row[9]),
        yidong_taxable_total: num(row[10]),
      };
      i += 1;
      while (i < summaryRows.length) {
        const noteRow = summaryRows[i] ?? [];
        const t = txt(noteRow[0]);
        if (t.startsWith('说明')) {
          note = (t + ' ' + noteRow.slice(1).map(txt).filter(Boolean).join(' ')).trim();
        }
        i += 1;
      }
      break;
    }
    if (!first) { i += 1; continue; }
    items.push({
      name: first,
      spec: txt(row[1]),
      unit: txt(row[2]),
      quantity: num(row[3]),
      unit_price: num(row[4]),
      taxable_unit_price: num(row[5]),
      tiejiang_taxable_unit_price: num(row[6]),
      yidong_taxable_unit_price: num(row[7]),
      total_taxable: num(row[8]),
      tiejiang_total: num(row[9]),
      yidong_total: num(row[10]),
      remark: txt(row[11]),
    });
    i += 1;
  }

  const summary = { title, items, totals, note };

  let points: QuoteData['points'];
  const pointsSheet = workbook.Sheets['Sheet2'] ?? workbook.Sheets[1];
  if (pointsSheet) {
    const pointsRows = XLSX.utils.sheet_to_json<unknown[]>(pointsSheet, { header: 1, raw: true, defval: '' }) as unknown[][];
    const cleaned = pointsRows.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
    const floors: NonNullable<QuoteData['points']>['floors'] = [];
    for (const row of cleaned) {
      const first = txt(row[0]);
      if (!first || first === '网线' || first === 'PVC') continue;
      const counts: number[] = [];
      let ap: string | undefined;
      for (let k = 1; k < row.length; k += 1) {
        const cell = txt(row[k]);
        if (cell === '') continue;
        if (/^[A-Za-z]/.test(cell)) {
          ap = row.slice(k).map(txt).filter(Boolean).join(' ');
          break;
        }
        counts.push(num(cell));
      }
      floors.push({ name: first, counts, ap });
    }
    if (floors.length > 0) points = { floors };
  }

  return {
    template: 'engineering-quote-v1',
    summary,
    points,
  };
}