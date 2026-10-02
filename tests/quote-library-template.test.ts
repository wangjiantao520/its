import assert from 'node:assert/strict';
import test from 'node:test';

import * as XLSX from 'xlsx-js-style';

import { parsePointsSheet, renderQuoteDataToWorkbook } from '../src/lib/quote-library-template';
import { createQuoteLibraryTemplateBuffer, parseWorkbookBufferToQuoteData } from '../src/lib/quote-library-server-export';
import { QUOTE_LIBRARY_TEMPLATE_VERSION, type QuoteData } from '../src/lib/quote-library-types';

test('generated quote import template is a valid workbook with usable entry sheets', () => {
  const buffer = createQuoteLibraryTemplateBuffer();
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  assert.deepEqual(workbook.SheetNames, ['汇总', 'Sheet2']);
  const summaryRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['汇总']!, {
    header: 1,
    defval: '',
  });
  const pointRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Sheet2']!, {
    header: 1,
    defval: '',
  });
  assert.equal(summaryRows.filter((row) => row.every((cell) => cell === '')).length, 10);
  assert.deepEqual(pointRows[0], ['楼层', '网线数量', 'PVC数量', 'AP信息']);
  assert.equal(pointRows.length, 11);

  const parsed = parseWorkbookBufferToQuoteData(buffer);
  assert.equal(parsed.summary.items.length, 0);
  assert.deepEqual(parsed.summary.totals, {
    taxable_total: 0,
    tiejiang_taxable_total: 0,
    yidong_taxable_total: 0,
  });
  assert.equal(parsed.points, undefined);
});

test('point parser preserves Chinese and Latin AP descriptions without turning them into quantities', () => {
  const floors = parsePointsSheet([
    ['楼层', '网线数量', 'PVC数量', 'AP信息'],
    ['1F', 4, 2, '无线AP：走廊和会议室'],
    ['2F', 3, 0, 'AP-02 / AP-03'],
    ['3F', 0, 0, ''],
    ['合计', 7, 2, ''],
  ]);

  assert.deepEqual(floors, [
    { name: '1F', counts: [4, 2], ap: '无线AP：走廊和会议室' },
    { name: '2F', counts: [3, 0], ap: 'AP-02 / AP-03' },
    { name: '3F', counts: [0, 0] },
  ]);
});

test('quote summary and floor details survive workbook export and import', () => {
  const data: QuoteData = {
    template: QUOTE_LIBRARY_TEMPLATE_VERSION,
    summary: {
      title: '回归测试报价',
      items: [{
        name: '六类网线',
        spec: 'CAT6',
        unit: '箱',
        quantity: 2,
        unit_price: 500,
        taxable_unit_price: 530,
        tiejiang_taxable_unit_price: 561.8,
        yidong_taxable_unit_price: 572.4,
        total_taxable: 1060,
        tiejiang_total: 1123.6,
        yidong_total: 1144.8,
        remark: '测试备注',
      }],
      totals: {
        taxable_total: 1060,
        tiejiang_taxable_total: 1123.6,
        yidong_taxable_total: 1144.8,
      },
      note: '测试说明',
    },
    points: { floors: [{ name: '2F', counts: [3, 2], ap: '走廊 AP-02' }] },
  };
  const workbook = renderQuoteDataToWorkbook(data);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const parsed = parseWorkbookBufferToQuoteData(buffer);

  assert.equal(parsed.summary.title, data.summary.title);
  assert.deepEqual(parsed.summary.items, data.summary.items);
  assert.deepEqual(parsed.summary.totals, data.summary.totals);
  assert.equal(parsed.summary.note, data.summary.note);
  assert.deepEqual(parsed.points, data.points);
});
