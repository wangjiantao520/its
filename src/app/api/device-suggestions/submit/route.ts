import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { insertDeviceSuggestion } from '@/lib/device-suggestion-store';

const deviceSchema = z.object({
  name: z.string().min(1, '设备名称不能为空'),
  category: z.string().default(''),
  brand: z.string().default(''),
  model: z.string().default(''),
  specification: z.string().default(''),
  maintenanceTier: z.string().default('C档'),
  level: z.string().default('B'),
  engineerLevel: z.string().default('初级'),
  tempUnitPrice: z.coerce.number().finite().nonnegative().default(0),
  quantity: z.coerce.number().int().positive().default(1),
  location: z.string().default(''),
  comment: z.string().default(''),
});

const submitSchema = z.object({
  source: z.enum(['engineering', 'maintenance']),
  quoteId: z.string(),
  quoteNumber: z.string(),
  projectName: z.string().min(1, '项目名称不能为空'),
  devices: z.array(deviceSchema).min(1, '至少需要一个补录设备'),
});

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

  const submittedBy = auth.session.name || auth.session.username || auth.session.role;
  try {
    const database = getDatabase();
    const insertedIds = await Promise.all(
      parsed.data.devices.map((device) => insertDeviceSuggestion(database, {
        source: parsed.data.source,
        quoteId: parsed.data.quoteId,
        quoteNumber: parsed.data.quoteNumber,
        projectName: parsed.data.projectName,
        ...device,
      }, submittedBy)),
    );
    return NextResponse.json({ success: true, data: { ids: insertedIds } });
  } catch (error) {
    console.error('提交设备补录请求失败:', error);
    return NextResponse.json({ success: false, error: '提交设备补录请求失败' }, { status: 500 });
  }
}
