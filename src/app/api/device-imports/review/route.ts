import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { reviewDeviceImport } from '@/lib/device-import-store';

const reviewBaseSchema = {
  id: z.union([z.string(), z.number()]),
  comment: z.string().max(2000).optional(),
};

const reviewSchema = z.discriminatedUnion('action', [
  z.object({
    ...reviewBaseSchema,
    action: z.literal('approve'),
    cityPrice: z.coerce.number().finite().positive('城区基准年价必须大于 0'),
    replaceExisting: z.boolean().optional(),
  }),
  z.object({ ...reviewBaseSchema, action: z.literal('reject') }),
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

  try {
    const result = await reviewDeviceImport(getDatabase(), {
      id: String(parsed.data.id),
      action: parsed.data.action,
      reviewedBy: auth.session.name || auth.session.username || auth.session.role,
      cityPrice: parsed.data.action === 'approve' ? parsed.data.cityPrice : undefined,
      replaceExisting: parsed.data.action === 'approve' ? parsed.data.replaceExisting : undefined,
      reviewComment: parsed.data.comment,
    });
    if (!result.ok) {
      const status = result.error === '记录不存在' ? 404 : 409;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }
    return NextResponse.json({
      success: true,
      message: parsed.data.action === 'approve'
        ? (result.quotaAction === 'updated' ? '已审核并更新原有定额' : '已审核并写入设备定额')
        : '已拒绝申请',
      data: parsed.data.action === 'approve'
        ? { quotaId: result.quotaId, quotaAction: result.quotaAction }
        : undefined,
    });
  } catch (error) {
    console.error('审核设备导入失败:', error);
    return NextResponse.json({ success: false, error: '审核失败' }, { status: 500 });
  }
}
