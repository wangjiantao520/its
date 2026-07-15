import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { requireApiAuth } from '@/lib/api-auth-server';

const columns = [
  ['分类', 'category', 20], ['名称', 'name', 30], ['品牌', 'brand', 15],
  ['型号', 'model', 20], ['档次', 'level', 10], ['工程师等级', 'engineer_level', 15],
  ['年故障次数', 'annual_fault_count', 12], ['巡检费', 'inspection_fee', 12],
  ['上门费', 'visit_service_fee', 12], ['交通费', 'traffic_fee', 12],
  ['故障处理费', 'fault_handling_fee', 12], ['工具仪表摊销', 'tool_amortization', 12],
  ['耗材费', 'consumable_fee', 12], ['备件风险准备金', 'spare_part_reserve', 12],
  ['备件费', 'spare_part_fee', 12], ['第1年总价', 'year1_total_price', 12],
  ['第2年总价', 'year2_total_price', 12], ['第3年总价', 'year3_total_price', 12],
  ['城区价格', 'urban_price', 12], ['镇区价格', 'town_price', 12],
  ['乡村价格', 'rural_price', 12], ['单位', 'unit', 10], ['备注', 'note', 30],
] as const;

const example: Record<string, string | number> = {
  category: '计算机终端类', name: '台式计算机', brand: '联想', model: 'ThinkCentre M720Q',
  level: 'A', engineer_level: '中级', annual_fault_count: 2, inspection_fee: 50,
  visit_service_fee: 100, traffic_fee: 30, fault_handling_fee: 80, tool_amortization: 10,
  consumable_fee: 20, spare_part_reserve: 15, spare_part_fee: 50, year1_total_price: 500,
  year2_total_price: 450, year3_total_price: 400, urban_price: 500, town_price: 550,
  rural_price: 600, unit: '台', note: '示例数据',
};

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const sheet = XLSX.utils.aoa_to_sheet([
      columns.map(([header]) => header),
      columns.map(([, key]) => example[key] ?? ''),
    ]);
    sheet['!cols'] = columns.map(([, , width]) => ({ wch: width }));
    for (let index = 0; index < columns.length; index += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: index })];
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '1E40AF' } },
        alignment: { vertical: 'center', horizontal: 'center' },
      };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '设备定额模板');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="device-quota-template.xlsx"',
      },
    });
  } catch (error) {
    console.error('生成模板失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '生成模板失败' },
      { status: 500 },
    );
  }
}
