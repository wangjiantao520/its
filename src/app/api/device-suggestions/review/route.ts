import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { reviewDeviceSuggestion } from '@/lib/device-suggestion-store';
import type { DeviceSuggestionPriceData } from '@/lib/device-suggestions';

const priceDataSchema = z.object({
  category: z.string(),
  name: z.string().min(1, '设备名称不能为空'),
  brand: z.string(),
  model: z.string(),
  specification: z.string(),
  maintenanceTier: z.string(),
  level: z.string(),
  engineerLevel: z.string(),
  annualFaultCount: z.coerce.number().finite().nonnegative(),
  aGearFaultCount: z.coerce.number().finite().nonnegative(),
  bGearFaultCount: z.coerce.number().finite().nonnegative(),
  cGearFaultCount: z.coerce.number().finite().nonnegative(),
  dGearFaultCount: z.coerce.number().finite().nonnegative(),
  eGearFaultCount: z.coerce.number().finite().nonnegative(),
  faultProcessingDays: z.coerce.number().finite().nonnegative(),
  inspectionDays: z.coerce.number().finite().nonnegative(),
  onSiteCount: z.coerce.number().finite().nonnegative(),
  inspectionLaborFee: z.coerce.number().finite().nonnegative(),
  visitServiceFee: z.coerce.number().finite().nonnegative(),
  trafficFee: z.coerce.number().finite().nonnegative(),
  faultHandlingFee: z.coerce.number().finite().nonnegative(),
  toolAmortization: z.coerce.number().finite().nonnegative(),
  consumableFee: z.coerce.number().finite().nonnegative(),
  sparePartReserve: z.coerce.number().finite().nonnegative(),
  sparePartFee: z.coerce.number().finite().nonnegative(),
});

const baseSchema = {
  id: z.union([z.string(), z.number()]),
  comment: z.string().optional(),
};

const reviewSchema = z.discriminatedUnion('action', [
  z.object({ ...baseSchema, action: z.literal('approve'), priceData: priceDataSchema }),
  z.object({ ...baseSchema, action: z.literal('reject'), comment: z.string().min(1, '驳回原因不能为空') }),
]);

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是有效的 JSON' }, { status: 400 });
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: parsed.error.issues[0]?.message ?? '输入参数校验失败',
    }, { status: 400 });
  }

  const reviewedBy = auth.session.name || auth.session.username || auth.session.role;
  try {
    const result = await reviewDeviceSuggestion(getDatabase(), {
      id: String(parsed.data.id),
      action: parsed.data.action,
      priceData: parsed.data.action === 'approve' ? parsed.data.priceData as DeviceSuggestionPriceData : undefined,
      reviewedBy,
      comment: parsed.data.comment,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error ?? '审核失败' }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      message: parsed.data.action === 'approve' ? '已通过审核并入库' : '已驳回',
    });
  } catch (error) {
    console.error('审核设备补录失败:', error);
    return NextResponse.json({ success: false, error: '审核失败' }, { status: 500 });
  }
}
