import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { updateDeviceImportStatus } from '@/lib/device-import-store';

const reviewSchema = z.object({
  id: z.union([z.string(), z.number()]),
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
});

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
    const reviewed = await updateDeviceImportStatus(
      getDatabase(),
      String(parsed.data.id),
      parsed.data.action === 'approve' ? 'approved' : 'rejected',
      auth.session.name || auth.session.username || auth.session.role,
      parsed.data.comment,
    );
    if (!reviewed) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      message: parsed.data.action === 'approve' ? '已通过审核' : '已拒绝',
    });
  } catch (error) {
    console.error('审核设备导入失败:', error);
    return NextResponse.json({ success: false, error: '审核失败' }, { status: 500 });
  }
}
