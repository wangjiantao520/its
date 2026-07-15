import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consumeQuoteShare } from '@/lib/quote-share';

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ success: false, error: '无效的分享链接' }, { status: 400 });
    }

    const result = consumeQuoteShare(db, token);
    if (!result.ok) {
      if (result.reason === 'expired') {
        return NextResponse.json({ success: false, error: '分享链接已过期' }, { status: 410 });
      }
      if (result.reason === 'view_limit') {
        return NextResponse.json({ success: false, error: '分享链接访问次数已达上限' }, { status: 410 });
      }
      if (result.reason === 'quote_missing') {
        return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: '分享链接不存在或已失效' }, { status: 404 });
    }

    if (!result.quote) {
      return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: {
        quote: result.quote,
        share: { viewCount: result.viewCount, expiresAt: result.expiresAt },
      },
    });
  } catch (error) {
    console.error('获取分享报价失败:', error);
    return NextResponse.json({ success: false, error: '获取分享报价失败' }, { status: 500 });
  }
}
