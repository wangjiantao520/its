import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - 通过分享token查看报价（无需认证）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length !== 32) {
      return NextResponse.json(
        { success: false, error: '无效的分享链接' },
        { status: 400 }
      );
    }

    // 查询分享记录
    const [shareRows] = await pool.query(
      `SELECT id, quote_id, quote_type, expires_at, view_count
       FROM quote_shares
       WHERE token = ?`,
      [token]
    ) as [any[], any];

    const share = shareRows[0];
    if (!share) {
      return NextResponse.json(
        { success: false, error: '分享链接不存在或已失效' },
        { status: 404 }
      );
    }

    // 检查是否过期
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: '分享链接已过期' },
        { status: 410 }
      );
    }

    // 增加浏览次数
    await pool.query(
      `UPDATE quote_shares SET view_count = view_count + 1 WHERE id = ?`,
      [share.id]
    );

    // 根据报价类型查询详情
    const tableName = share.quote_type === 'engineering' ? 'engineering_quotes' : 'maintenance_quotes';

    // 通用字段（两个表都有的）
    let selectFields = 'id, quote_number, project_name, client_name, contact_person, contact_phone, total, created_at';
    let extraFields = '';

    if (share.quote_type === 'engineering') {
      selectFields += ', subtotal, tax';
    } else {
      selectFields += ', region, service_years';
    }

    // 查询报价详情
    const [quoteRows] = await pool.query(
      `SELECT ${selectFields} FROM ${tableName} WHERE id = ?`,
      [share.quote_id]
    ) as [any[], any];

    const quote = quoteRows[0];
    if (!quote) {
      return NextResponse.json(
        { success: false, error: '报价不存在' },
        { status: 404 }
      );
    }

    // 解析JSON字段（只处理存在的字段）
    const quoteData: any = { ...quote };
    if (quote.devices) {
      try {
        quoteData.devices = typeof quote.devices === 'string' ? JSON.parse(quote.devices) : quote.devices;
      } catch { quoteData.devices = []; }
    }
    if (quote.sla_config) {
      try {
        quoteData.slaConfig = typeof quote.sla_config === 'string' ? JSON.parse(quote.sla_config) : quote.sla_config;
      } catch { quoteData.slaConfig = null; }
    }

    return NextResponse.json({
      success: true,
      data: {
        quote: quoteData,
        share: {
          viewCount: share.view_count + 1,
          expiresAt: share.expires_at,
          isExpired: share.expires_at && new Date(share.expires_at) < new Date()
        }
      }
    });
  } catch (error) {
    console.error('获取分享报价失败:', error);
    return NextResponse.json(
      { success: false, error: '获取分享报价失败' },
      { status: 500 }
    );
  }
}
