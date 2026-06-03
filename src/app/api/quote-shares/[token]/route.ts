
import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';

// GET /api/quote-shares/[token] - 通过分享token获取报价单数据（公开接口，无需登录）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await initDatabase();

    const { token } = await params;

    // 查找分享记录
    const [shareRows] = await pool.execute(
      `SELECT id, quote_id, password, expires_at, max_views, view_count, is_active
       FROM quote_shares WHERE share_token = ?`,
      [token]
    );

    const shares = shareRows as any[];
    if (shares.length === 0) {
      return NextResponse.json(
        { success: false, error: '分享链接不存在' },
        { status: 404 }
      );
    }

    const share = shares[0];

    // 检查是否已停用
    if (share.is_active !== 1) {
      return NextResponse.json(
        { success: false, error: '该分享链接已被停用', code: 'INACTIVE' },
        { status: 410 }
      );
    }

    // 检查是否已过期
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: '该分享链接已过期', code: 'EXPIRED' },
        { status: 410 }
      );
    }

    // 检查是否超过最大查看次数
    if (share.max_views > 0 && share.view_count >= share.max_views) {
      return NextResponse.json(
        { success: false, error: '该分享链接查看次数已达上限', code: 'MAX_VIEWS' },
        { status: 410 }
      );
    }

    // 检查是否需要密码（密码验证通过单独的POST接口）
    const searchParams = request.nextUrl.searchParams;
    const needPassword = !!share.password;
    const providedPassword = searchParams.get('password');

    if (needPassword && providedPassword !== share.password) {
      return NextResponse.json({
        success: false,
        error: '需要密码验证',
        code: 'PASSWORD_REQUIRED',
        needPassword: true,
      }, { status: 401 });
    }

    // 获取报价单数据
    const [quoteRows] = await pool.execute(
      'SELECT * FROM engineering_quotes WHERE id = ?',
      [share.quote_id]
    );

    const quoteList = quoteRows as any[];
    if (quoteList.length === 0) {
      return NextResponse.json(
        { success: false, error: '报价单不存在' },
        { status: 404 }
      );
    }

    // 只返回安全的字段，不暴露内部ID、状态等
    const raw = quoteList[0];
    const quote = {
      quote_number: raw.quote_number,
      project_name: raw.project_name,
      client_name: raw.client_name,
      contact_person: raw.contact_person,
      contact_phone: raw.contact_phone,
      construction_area: raw.construction_area,
      management_rate: raw.management_rate,
      profit_rate: raw.profit_rate,
      regulatory_rate: raw.regulatory_rate,
      tax_rate: raw.tax_rate,
      subtotal: raw.subtotal,
      management_fee: raw.management_fee,
      profit: raw.profit,
      regulatory_fee: raw.regulatory_fee,
      tax: raw.tax,
      total: raw.total,
      items: typeof raw.items === 'string' ? JSON.parse(raw.items) : raw.items,
      created_at: raw.created_at,
    };

    // 增加查看次数
    await pool.execute(
      'UPDATE quote_shares SET view_count = view_count + 1 WHERE id = ?',
      [share.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        quote,
        shareInfo: {
          expiresAt: share.expires_at,
          maxViews: share.max_views,
          viewCount: share.view_count + 1,
        },
      },
    });
  } catch (error) {
    console.error('获取分享报价单失败:', error);
    return NextResponse.json(
      { success: false, error: '获取分享报价单失败' },
      { status: 500 }
    );
  }
}

// POST /api/quote-shares/[token] - 密码验证后获取报价单数据
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await initDatabase();

    const { token } = await params;
    const body = await request.json();
    const { password } = body;

    // 查找分享记录
    const [shareRows] = await pool.execute(
      `SELECT id, quote_id, password, expires_at, max_views, view_count, is_active
       FROM quote_shares WHERE share_token = ?`,
      [token]
    );

    const shares = shareRows as any[];
    if (shares.length === 0) {
      return NextResponse.json(
        { success: false, error: '分享链接不存在' },
        { status: 404 }
      );
    }

    const share = shares[0];

    // 检查是否已停用
    if (share.is_active !== 1) {
      return NextResponse.json(
        { success: false, error: '该分享链接已被停用', code: 'INACTIVE' },
        { status: 410 }
      );
    }

    // 检查是否已过期
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: '该分享链接已过期', code: 'EXPIRED' },
        { status: 410 }
      );
    }

    // 检查是否超过最大查看次数
    if (share.max_views > 0 && share.view_count >= share.max_views) {
      return NextResponse.json(
        { success: false, error: '该分享链接查看次数已达上限', code: 'MAX_VIEWS' },
        { status: 410 }
      );
    }

    // 验证密码
    if (share.password && password !== share.password) {
      return NextResponse.json(
        { success: false, error: '密码错误', code: 'WRONG_PASSWORD' },
        { status: 401 }
      );
    }

    // 获取报价单数据
    const [quoteRows] = await pool.execute(
      'SELECT * FROM engineering_quotes WHERE id = ?',
      [share.quote_id]
    );

    const quoteList = quoteRows as any[];
    if (quoteList.length === 0) {
      return NextResponse.json(
        { success: false, error: '报价单不存在' },
        { status: 404 }
      );
    }

    // 只返回安全的字段，不暴露内部ID、状态等
    const raw = quoteList[0];
    const quote = {
      quote_number: raw.quote_number,
      project_name: raw.project_name,
      client_name: raw.client_name,
      contact_person: raw.contact_person,
      contact_phone: raw.contact_phone,
      construction_area: raw.construction_area,
      management_rate: raw.management_rate,
      profit_rate: raw.profit_rate,
      regulatory_rate: raw.regulatory_rate,
      tax_rate: raw.tax_rate,
      subtotal: raw.subtotal,
      management_fee: raw.management_fee,
      profit: raw.profit,
      regulatory_fee: raw.regulatory_fee,
      tax: raw.tax,
      total: raw.total,
      items: typeof raw.items === 'string' ? JSON.parse(raw.items) : raw.items,
      created_at: raw.created_at,
    };

    // 增加查看次数
    await pool.execute(
      'UPDATE quote_shares SET view_count = view_count + 1 WHERE id = ?',
      [share.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        quote,
        shareInfo: {
          expiresAt: share.expires_at,
          maxViews: share.max_views,
          viewCount: share.view_count + 1,
        },
      },
    });
  } catch (error) {
    console.error('获取分享报价单失败:', error);
    return NextResponse.json(
      { success: false, error: '获取分享报价单失败' },
      { status: 500 }
    );
  }
}
