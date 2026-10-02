import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';

import { createEmptySurveyForm, parseSurveyExcel } from '../src/lib/survey-parser';

function createWorkbookBuffer(rows: string[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '查勘记录');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Uint8Array;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

test('survey parser extracts supported label/value pairs without inventing missing values', () => {
  const result = parseSurveyExcel(createWorkbookBuffer([
    ['单位名称', '海峡智造'],
    ['对接人姓名', '林工'],
    ['前期是否维保服务单位', '没有'],
  ]));

  assert.equal(result.basicInfo.companyName, '海峡智造');
  assert.equal(result.basicInfo.contactPerson, '林工');
  assert.equal(result.basicInfo.previousService, false);
  assert.equal(result.basicInfo.hasUnreturnedTools, null);
  assert.equal(result.requirements.isResident, null);
  assert.deepEqual(result.scope.computers, []);
});

test('survey parser leaves ambiguous yes/no answers unknown', () => {
  const result = parseSurveyExcel(createWorkbookBuffer([
    ['前期是否维保服务单位', '待确认'],
  ]));

  assert.equal(result.basicInfo.previousService, null);
});

test('survey parser rejects workbooks without recognized labels', () => {
  assert.throws(
    () => parseSurveyExcel(createWorkbookBuffer([['客户名称', '海峡智造']])),
    /未识别到查勘记录字段/,
  );
});

test('empty survey form uses unknown or empty values rather than false survey answers', () => {
  const form = createEmptySurveyForm();

  assert.equal(form.basicInfo.previousService, null);
  assert.equal(form.basicInfo.systemTransition, null);
  assert.deepEqual(form.scope.servers, []);
  assert.deepEqual(form.requirements.serviceType, []);
});

test('survey parser rejects a blank supported template instead of reporting a usable import', () => {
  assert.throws(
    () => parseSurveyExcel(createWorkbookBuffer([
      ['单位名称', ''],
      ['对接人姓名', ''],
    ])),
    /没有填写可保存的内容/,
  );
});
