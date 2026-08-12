import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { listDeviceSuggestions } from '@/lib/device-suggestion-store';

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const mine = request.nextUrl.searchParams.get('mine') === 'true';
  const status = request.nextUrl.searchParams.get('status');

  try {
    const records = await listDeviceSuggestions(getDatabase(), {
      status: status === 'pending' || status === 'approved' || status === 'rejected'
        ? status
        : undefined,
      submittedBy: mine ? (auth.session.name || auth.session.username || undefined) : undefined,
    });
    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('获取设备补录请求失败:', error);
    return NextResponse.json({ success: false, error: '获取设备补录请求失败' }, { status: 500 });
  }
}
