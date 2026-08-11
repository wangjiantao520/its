import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { requireApiAuth } from '@/lib/api-auth-server';

type TemplateColumn = readonly [header: string, key: string, width: number];

// 成员端设备清单导入模板列
const columns: TemplateColumn[] = [
  ['设备分类', 'category', 20],
  ['设备名称', 'name', 30],
  ['规格/型号', 'model', 20],
  ['维保分档(A-E)', 'level', 12],
  ['进场工程师等级', 'engineerLevel', 16],
  ['设备数量', 'deviceCount', 10],
  ['是否需要备件(是/否)', 'needSparePart', 16],
  ['运维团队经验-有系数', 'teamExperienceWithFactor', 16],
  ['运维团队经验-类似系数', 'teamExperienceSimilarFactor', 16],
  ['运维团队经验-无系数', 'teamExperienceWithoutFactor', 16],
  ['安全等级-第三级系数', 'securityLevel3Factor', 16],
  ['支持方式-现场为主系数', 'supportModeOnsiteFactor', 18],
  ['故障恢复时间-≤24h系数', 'faultRecoveryTime24hFactor', 20],
  ['巡检人工费', 'inspectionLaborFee', 12],
  ['巡检人数', 'inspectionPersonCount', 10],
  ['巡检时长(分钟)', 'inspectionDuration', 12],
  ['年基础服务次数', 'inspectionTimesPerYear', 14],
  ['巡检内容', 'inspectionContent', 30],
  ['故障上门服务费', 'onSiteFeeAnnual', 14],
  ['交通费(元)', 'trafficFee', 12],
  ['故障处理费', 'faultHandlingFeeTotal', 14],
  ['是否在保(是/否)', 'inWarranty', 14],
  ['成新率(全新/较新/一般/偏旧/老旧)', 'depreciationLevelDescription', 26],
  ['工具仪表摊销(元)', 'toolAmortization', 16],
  ['耗材费', 'consumableFee', 10],
  ['工具仪表明细', 'toolDetails', 30],
  ['耗材明细', 'consumableDetails', 30],
  ['备件风险准备金(元)', 'sparePartReserve', 16],
  ['备件准备金测算依据', 'sparePartBasis', 30],
  ['城区报价(元/年)', 'cityPrice', 14],
  ['其中故障处理费(元/年)', 'faultHandlingFeeDetail', 18],
  ['市区县城郊区总价(元/台·年)', 'urbanPrice', 18],
  ['乡镇总价(元/台·年)', 'townPrice', 16],
  ['农村总价(元/台·年)', 'ruralPrice', 16],
  ['合同年限(1/2/3)', 'contractYears', 12],
  ['核心维保内容', 'coreMaintenanceContent', 40],
] as const;

const example: Record<string, string | number> = {
  category: '计算机终端类',
  name: '台式计算机',
  model: 'ThinkCentre M720Q',
  level: 'B',
  engineerLevel: '初级',
  deviceCount: 5,
  needSparePart: '否',
  teamExperienceWithFactor: 1.2,
  teamExperienceSimilarFactor: 1.0,
  teamExperienceWithoutFactor: 0.8,
  securityLevel3Factor: 1.0,
  supportModeOnsiteFactor: 1.0,
  faultRecoveryTime24hFactor: 1.0,
  inspectionLaborFee: 50,
  inspectionPersonCount: 1,
  inspectionDuration: 30,
  inspectionTimesPerYear: 4,
  inspectionContent: '巡检设备运行状态',
  onSiteFeeAnnual: 100,
  trafficFee: 30,
  faultHandlingFeeTotal: 80,
  inWarranty: '否',
  depreciationLevelDescription: '一般',
  toolAmortization: 10,
  consumableFee: 20,
  toolDetails: '螺丝刀、检测仪',
  consumableDetails: '清洁剂、扎带',
  sparePartReserve: 50,
  sparePartBasis: '按设备价值5%预留',
  cityPrice: 500,
  faultHandlingFeeDetail: 80,
  urbanPrice: 550,
  townPrice: 750,
  ruralPrice: 1000,
  contractYears: 1,
  coreMaintenanceContent: '硬件巡检、故障处理、备件支持',
};

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const sheet = XLSX.utils.aoa_to_sheet([
      columns.map(([header]) => header),
      columns.map(([, key]) => example[key] ?? ''),
    ]);
    sheet['!cols'] = columns.map(([, , width]) => ({ wch: width }));
    for (let index = 0; index < columns.length; index += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: index })];
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: '1E40AF' } },
          alignment: { vertical: 'center', horizontal: 'center' },
        };
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '设备清单导入模板');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="device-import-template.xlsx"',
      },
    });
  } catch (error) {
    console.error('生成设备清单导入模板失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '生成模板失败' },
      { status: 500 },
    );
  }
}
