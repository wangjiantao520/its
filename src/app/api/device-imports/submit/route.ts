import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { verifySecondaryPassword } from '@/lib/secondary-password';
import { insertDeviceImportBatch } from '@/lib/device-import-store';
import type { DeviceImportItem } from '@/lib/device-imports';

const optionalNumber = z.coerce.number().finite().nonnegative().optional();
const optionalText = z.string().max(4000).optional();

const deviceSchema = z.object({
  category: z.string().trim().min(1, '设备分类不能为空'),
  name: z.string().trim().min(1, '设备名称不能为空'),
  model: z.string().max(500),
  level: z.enum(['A', 'B', 'C', 'D', 'E']),
  engineerLevel: z.enum(['初级', '中级', '高级']),
  deviceCount: z.coerce.number().int().positive(),
  contractYears: z.coerce.number().int().min(1).max(3),
  needSparePart: z.boolean().optional(),
  teamExperienceWithFactor: optionalNumber,
  teamExperienceSimilarFactor: optionalNumber,
  teamExperienceWithoutFactor: optionalNumber,
  securityLevel1Factor: optionalNumber,
  securityLevel2Factor: optionalNumber,
  securityLevel3Factor: optionalNumber,
  securityLevel4Factor: optionalNumber,
  securityLevel5Factor: optionalNumber,
  supportModeOffsiteFactor: optionalNumber,
  supportModeOnsiteFactor: optionalNumber,
  supportModePureOnsiteFactor: optionalNumber,
  faultRecoveryTime4hFactor: optionalNumber,
  faultRecoveryTime24hFactor: optionalNumber,
  faultRecoveryTime48hFactor: optionalNumber,
  faultRecoveryTime72hFactor: optionalNumber,
  arrivalTime2hFactor: optionalNumber,
  arrivalTime8hFactor: optionalNumber,
  responseTime10minFactor: optionalNumber,
  responseTime30minFactor: optionalNumber,
  serviceTime5x8Factor: optionalNumber,
  serviceTime7x8Factor: optionalNumber,
  serviceTime7x24Factor: optionalNumber,
  slaTotalFactor: optionalNumber,
  inspectionLaborFee: optionalNumber,
  inspectionPersonCount: optionalNumber,
  inspectionDuration: optionalNumber,
  inspectionTimesPerYear: optionalNumber,
  inspectionContent: optionalText,
  inspectionFeeAnnual: optionalNumber,
  onSiteFeeAnnual: optionalNumber,
  trafficFee: optionalNumber,
  singleTripDuration: optionalNumber,
  connectionDuration: optionalNumber,
  onSiteConnectionLaborFee: optionalNumber,
  faultHandlingFeeTotal: optionalNumber,
  faultHandlingLaborFee: optionalNumber,
  inWarrantyFactor: optionalNumber,
  depreciationLevelDescription: z.enum(['全新', '较新', '一般', '偏旧', '老旧']).optional(),
  deviceGrade: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
  depreciationGrade: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ]).optional(),
  baseFaultCount: optionalNumber,
  depreciationFactor: optionalNumber,
  faultServiceCount: optionalNumber,
  faultHandlerCount: optionalNumber,
  faultHandlingDuration: optionalNumber,
  toolAmortization: optionalNumber,
  toolDetails: optionalText,
  consumableFee: optionalNumber,
  consumableDetails: optionalText,
  sparePartReserve: optionalNumber,
  sparePartFee: optionalNumber,
  sparePartBasis: optionalText,
  cityPrice: optionalNumber,
  faultHandlingFeeDetail: optionalNumber,
  bulkDiscountNote: optionalText,
  serviceTimeNote: optionalText,
  year1TotalPrice: optionalNumber,
  year2TotalPrice: optionalNumber,
  year3TotalPrice: optionalNumber,
  urbanPrice: optionalNumber,
  townPrice: optionalNumber,
  ruralPrice: optionalNumber,
  coreMaintenanceContent: optionalText,
  unit: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  lastUpdated: z.string().max(100).optional(),
  dataSource: z.string().max(500).optional(),
  originalPrice: optionalNumber,
  quantity: optionalNumber,
  annualFee: optionalNumber,
  maintenanceRate: optionalNumber,
  networkType: z.string().max(100).optional(),
  levelName: z.string().max(100).optional(),
  levelDescription: optionalText,
  serialNumber: z.coerce.number().int().nonnegative().optional(),
});

const submitSchema = z.object({
  secondaryPassword: z.string().min(1, '二级密码不能为空'),
  devices: z.array(deviceSchema).min(1, '至少需要一台设备').max(500, '单次最多提交 500 台设备'),
});

type ParsedDevice = z.infer<typeof deviceSchema>;

function toImportItem(device: ParsedDevice): Partial<DeviceImportItem> {
  return device;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin', 'its_member']);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是有效的 JSON' }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: parsed.error.issues[0]?.message ?? '输入参数校验失败',
    }, { status: 400 });
  }

  const ok = await verifySecondaryPassword(getDatabase(), parsed.data.secondaryPassword);
  if (!ok) {
    return NextResponse.json({ success: false, error: '二级密码错误' }, { status: 403 });
  }

  const database = getDatabase();
  const submittedBy = auth.session.name || auth.session.username || auth.session.role;
  const devices = parsed.data.devices.map(toImportItem);
  const keys = new Set<string>();
  for (const device of devices) {
    const key = JSON.stringify([device.category, device.name, device.model ?? '']);
    if (keys.has(key)) {
      return NextResponse.json({ success: false, error: `同一批次包含重复设备：${device.name}` }, { status: 400 });
    }
    keys.add(key);
  }

  let ids: string[];
  try {
    ids = await insertDeviceImportBatch(database, devices, submittedBy);
  } catch (error) {
    console.error('提交设备清单失败:', error);
    return NextResponse.json({ success: false, error: '提交失败，未写入任何设备申请，请检查后重试' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `提交成功：${ids.length} 台设备待审核`,
    count: ids.length,
  });
}
