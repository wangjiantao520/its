import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function GET(request: NextRequest) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('设备定额模板');

    // 设置列标题
    sheet.columns = [
      { header: '分类', key: 'category', width: 20 },
      { header: '名称', key: 'name', width: 30 },
      { header: '品牌', key: 'brand', width: 15 },
      { header: '型号', key: 'model', width: 20 },
      { header: '档次', key: 'level', width: 10 },
      { header: '工程师等级', key: 'engineer_level', width: 15 },
      { header: '年故障次数', key: 'annual_fault_count', width: 12 },
      { header: '巡检费', key: 'inspection_fee', width: 12 },
      { header: '上门费', key: 'visit_service_fee', width: 12 },
      { header: '交通费', key: 'traffic_fee', width: 12 },
      { header: '故障处理费', key: 'fault_handling_fee', width: 12 },
      { header: '工具仪表摊销', key: 'tool_amortization', width: 12 },
      { header: '耗材费', key: 'consumable_fee', width: 12 },
      { header: '备件风险准备金', key: 'spare_part_reserve', width: 12 },
      { header: '备件费', key: 'spare_part_fee', width: 12 },
      { header: '第1年总价', key: 'year1_total_price', width: 12 },
      { header: '第2年总价', key: 'year2_total_price', width: 12 },
      { header: '第3年总价', key: 'year3_total_price', width: 12 },
      { header: '城区价格', key: 'urban_price', width: 12 },
      { header: '镇区价格', key: 'town_price', width: 12 },
      { header: '乡村价格', key: 'rural_price', width: 12 },
      { header: '单位', key: 'unit', width: 10 },
      { header: '备注', key: 'note', width: 30 },
    ];

    // 添加示例数据
    sheet.addRow({
      category: '计算机终端类',
      name: '台式计算机',
      brand: '联想',
      model: 'ThinkCentre M720Q',
      level: 'A',
      engineer_level: '中级',
      annual_fault_count: 2,
      inspection_fee: 50,
      visit_service_fee: 100,
      traffic_fee: 30,
      fault_handling_fee: 80,
      tool_amortization: 10,
      consumable_fee: 20,
      spare_part_reserve: 15,
      spare_part_fee: 50,
      year1_total_price: 500,
      year2_total_price: 450,
      year3_total_price: 400,
      urban_price: 500,
      town_price: 550,
      rural_price: 600,
      unit: '台',
      note: '示例数据',
    });

    // 设置标题行样式
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // 生成 Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="设备定额导入模板.xlsx"',
      },
    });
  } catch (error) {
    console.error('生成模板失败:', error);
    return NextResponse.json(
      { error: '生成模板失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
