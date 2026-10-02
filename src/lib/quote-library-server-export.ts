/**
 * 报价资料库服务端 Excel 导出工具。
 *
 * 复用 quote-library-template 的 renderQuoteDataToWorkbook（xlsx-js-style，深蓝表头/边框/列宽），
 * 服务端与浏览器导出风格一致。
 */

import * as XLSX from 'xlsx-js-style';

import { QUOTE_LIBRARY_TEMPLATE_VERSION, type QuoteData } from './quote-library-types';
import {
  parsePointsSheet,
  parseSummarySheet,
  renderQuoteDataToWorkbook,
} from './quote-library-template';

export function dataToWorkbookBuffer(data: QuoteData): Buffer {
  const workbook = renderQuoteDataToWorkbook(data);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export function createQuoteLibraryTemplateBuffer(): Buffer {
  const templateData: QuoteData = {
    template: QUOTE_LIBRARY_TEMPLATE_VERSION,
    summary: {
      title: '工程报价导入模板',
      items: [],
      totals: {
        taxable_total: 0,
        tiejiang_taxable_total: 0,
        yidong_taxable_total: 0,
      },
      note: '请在空白行填写明细；导入前核对三类含税总价。点位表按楼层填写网线、PVC数量及AP信息。',
    },
  };
  const workbook = renderQuoteDataToWorkbook(templateData, {
    blankItemRows: 10,
    includePointsTemplate: true,
  });
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
  const summary = parseSummarySheet(summaryRows);

  let points: QuoteData['points'];
  const pointsSheet = workbook.Sheets['Sheet2'] ?? workbook.Sheets[1];
  if (pointsSheet) {
    const pointsRows = XLSX.utils.sheet_to_json<unknown[]>(pointsSheet, { header: 1, raw: true, defval: '' }) as unknown[][];
    const floors = parsePointsSheet(pointsRows);
    if (floors.length > 0) points = { floors };
  }

  return {
    template: QUOTE_LIBRARY_TEMPLATE_VERSION,
    summary,
    ...(points ? { points } : {}),
  };
}
