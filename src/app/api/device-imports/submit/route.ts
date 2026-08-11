import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { verifySecondaryPassword } from '@/lib/secondary-password';
import { insertDeviceImport } from '@/lib/device-import-store';
import type { MaintenanceLevel, EngineerLevel } from '@/lib/device-imports';

const deviceSchema = z.object({
  category: z.string(),
  name: z.string().min(1, '设备名称不能为空'),
  model: z.string(),
  level: z.string(),
  engineerLevel: z.string(),
  deviceCount: z.coerce.number().int().positive(),
  contractYears: z.coerce.number().int().min(1).max(3),
  needSparePart: z.boolean().optional(),
});

const submitSchema = z.object({
  secondaryPassword: z.string().min(1, '二级密码不能为空'),
  devices: z.array(deviceSchema).min(1, '至少需要一台设备'),
});

type ParsedDevice = z.infer<typeof deviceSchema>;

function toImportItem(device: ParsedDevice): Partial<import('@/lib/device-imports').DeviceImportItem> {
  return {
    category: device.category,
    name: device.name,
    model: device.model,
    level: device.level as MaintenanceLevel,
    engineerLevel: device.engineerLevel as EngineerLevel,
    deviceCount: device.deviceCount,
    needSparePart: device.needSparePart,
    contractYears: device.contractYears,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
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
  const submitted = parsed.data.devices.map((device) =>
    insertDeviceImport(database, toImportItem(device), submittedBy),
  );
  const ids = await Promise.all(submitted);

  return NextResponse.json({
    success: true,
    message: `提交成功：${ids.length} 台设备待审核`,
    count: ids.length,
  });
}
