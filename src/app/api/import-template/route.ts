import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { requireApiAuth } from '@/lib/api-auth-server';

type TemplateColumn = readonly [header: string, key: string, width: number];

// 设备定额模板（device_quotas）
// 列顺序与 src/app/api/import-file/import-devices.ts 的 parseDeviceRows 列下标严格对齐
const deviceColumns: TemplateColumn[] = [
  ['分类', 'category', 20], ['设备名称', 'name', 30], ['品牌', 'brand', 15],
  ['型号', 'model', 20], ['档次', 'level', 10], ['工程师等级', 'engineer_level', 15],
  ['年故障次数', 'annual_fault_count', 12], ['巡检费(元/次)', 'inspection_fee', 14],
  ['上门费(元/次)', 'visit_service_fee', 14], ['交通费(元/次)', 'traffic_fee', 14],
  ['故障处理费(元/次)', 'fault_handling_fee', 16], ['工具仪表摊销(元)', 'tool_amortization', 16],
  ['耗材费(元)', 'consumable_fee', 12], ['备件风险准备金(元)', 'spare_part_reserve', 16],
  ['备件费(元)', 'spare_part_fee', 12], ['第1年总价(元)', 'year1_total_price', 14],
  ['第2年总价(元)', 'year2_total_price', 14], ['第3年总价(元)', 'year3_total_price', 14],
  ['城区价格(元)', 'urban_price', 14], ['镇区价格(元)', 'town_price', 14],
  ['乡村价格(元)', 'rural_price', 14], ['单位', 'unit', 10], ['备注', 'note', 30],
] as const;

const deviceExample: Record<string, string | number> = {
  category: '计算机终端类', name: '台式计算机', brand: '联想', model: 'ThinkCentre M720Q',
  level: 'A', engineer_level: '中级', annual_fault_count: 2, inspection_fee: 50,
  visit_service_fee: 100, traffic_fee: 30, fault_handling_fee: 80, tool_amortization: 10,
  consumable_fee: 20, spare_part_reserve: 15, spare_part_fee: 50, year1_total_price: 500,
  year2_total_price: 450, year3_total_price: 400, urban_price: 500, town_price: 550,
  rural_price: 600, unit: '台', note: '示例数据，导入前请删除本行',
};

// 云数据中心定额库模板（maintenance_device_quotas）
// 列与 maintenance_device_quotas 表结构对齐
const maintenanceDeviceColumns: TemplateColumn[] = [
  ['分类', 'category', 22], ['设备名称', 'name', 30], ['品牌', 'brand', 15],
  ['型号', 'model', 25], ['规格', 'specification', 30], ['单位', 'unit', 10],
  ['数量', 'quantity', 10], ['中标单价(元)', 'original_price', 14],
  ['维保费率(%)', 'maintenance_rate', 14], ['年维保费(元)', 'annual_fee', 14],
  ['网络类型', 'network_type', 12], ['备注', 'remark', 30],
] as const;

const maintenanceDeviceExample: Record<string, string | number> = {
  category: '内网-网络系统', name: '内网核心交换机', brand: 'H3C', model: 'S12500R-48C6D',
  specification: '48口万兆+6口100G', unit: '台', quantity: 1, original_price: 280000,
  maintenance_rate: 6, annual_fee: 16800, network_type: '内网', remark: '示例数据，导入前请删除本行',
};

const templates: Record<string, { sheetName: string; filename: string; columns: TemplateColumn[]; example: Record<string, string | number> }> = {
  device_quotas: {
    sheetName: '设备定额模板',
    filename: 'device-quota-template.xlsx',
    columns: deviceColumns,
    example: deviceExample,
  },
  maintenance_device_quotas: {
    sheetName: '云数据中心定额库模板',
    filename: 'maintenance-device-template.xlsx',
    columns: maintenanceDeviceColumns,
    example: maintenanceDeviceExample,
  },
};

function fillHeaderStyle(sheet: XLSX.WorkSheet, columns: TemplateColumn[], row = 0): void {
  for (let index = 0; index < columns.length; index += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: index })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '1E40AF' } },
        alignment: { vertical: 'center', horizontal: 'center' },
      };
    }
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const type = request.nextUrl.searchParams.get('type') ?? 'device_quotas';
  const template = templates[type] ?? templates.device_quotas;
  const { sheetName, filename, columns, example } = template;

  try {
    const header = columns.map(([label]) => label);
    const dataRows: (string | number)[][] = [
      columns.map(([, key]) => example[key] ?? ''),
    ];

    const sheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    sheet['!cols'] = columns.map(([, , width]) => ({ wch: width }));
    fillHeaderStyle(sheet, columns);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
