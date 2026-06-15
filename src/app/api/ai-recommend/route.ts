import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// 根据客户/设备信息推荐相似历史报价
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientName = searchParams.get('clientName');
  const clientId = searchParams.get('clientId');
  const deviceName = searchParams.get('deviceName');
  const limit = parseInt(searchParams.get('limit') || '5');

  try {
    const conn = await pool.getConnection();
    try {
      // 优先按客户名匹配，否则按设备名匹配
      let query = '';
      const params: any[] = [];

      if (clientName || clientId) {
        // 客户级推荐：找该客户的所有历史报价设备
        query = `
          SELECT client_name, device_signature, device_data, quote_total, created_at,
                 COUNT(*) as occurrence
          FROM quote_device_history
          WHERE 1=1
        `;
        if (clientId) {
          query += ' AND client_id = ?';
          params.push(parseInt(clientId));
        } else if (clientName) {
          query += ' AND client_name = ?';
          params.push(clientName);
        }
        query += ' GROUP BY device_signature ORDER BY created_at DESC LIMIT ?';
        params.push(limit);
      } else if (deviceName) {
        // 设备级推荐：找相似设备的历史报价
        query = `
          SELECT client_name, device_signature, device_data, quote_total, created_at,
                 COUNT(*) as occurrence
          FROM quote_device_history
          WHERE device_signature LIKE ?
          GROUP BY device_signature
          ORDER BY created_at DESC LIMIT ?
        `;
        params.push(`%${deviceName.toLowerCase()}%`, limit);
      } else {
        // 总体推荐：找最近的高频报价设备
        query = `
          SELECT client_name, device_signature, device_data, quote_total, created_at,
                 COUNT(*) as occurrence
          FROM quote_device_history
          GROUP BY device_signature
          ORDER BY created_at DESC LIMIT ?
        `;
        params.push(limit);
      }

      const [rows] = await conn.execute(query, params);
      return NextResponse.json({
        success: true,
        data: rows,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('[AI Recommend] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 保存报价设备历史（供后续推荐使用）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteId, quoteType, clientId, clientName, devices, quoteTotal } = body;

    if (!quoteId || !quoteType || !devices || devices.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    try {
      // 批量插入设备历史
      for (const device of devices) {
        const deviceName = device.deviceName || device.name || '其他';
        const useYears = device.useYears || device.useYear;
        const signature = `${(deviceName).toLowerCase()}::${!useYears ? 'unknown' : useYears <= 1 ? 'new' : useYears <= 3 ? 'mid' : 'old'}`;

        await conn.execute(
          `INSERT INTO quote_device_history
           (quote_id, quote_type, client_id, client_name, device_signature, device_data, quote_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            quoteId,
            quoteType,
            clientId || null,
            clientName || null,
            signature,
            JSON.stringify(device),
            quoteTotal || null,
          ]
        );
      }

      return NextResponse.json({ success: true });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('[AI Recommend] 保存失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
