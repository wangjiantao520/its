import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// 设备签名：归一化设备名称+类型，用于相似匹配
function buildDeviceSignature(deviceName: string, useYears?: number): string {
  const norm = (deviceName || '').trim().toLowerCase();
  const ageBucket = !useYears ? 'unknown' : useYears <= 1 ? 'new' : useYears <= 3 ? 'mid' : 'old';
  return `${norm}::${ageBucket}`;
}

// 查询客户历史学习记忆
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const clientName = searchParams.get('clientName');
  const deviceName = searchParams.get('deviceName');
  const useYears = searchParams.get('useYears');
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    const conn = await pool.getConnection();
    try {
      let query = 'SELECT * FROM ai_learning_memory WHERE 1=1';
      const params: any[] = [];

      if (clientId) {
        query += ' AND client_id = ?';
        params.push(parseInt(clientId));
      } else if (clientName) {
        query += ' AND client_name = ?';
        params.push(clientName);
      }

      if (deviceName) {
        const sig = buildDeviceSignature(deviceName, useYears ? parseInt(useYears) : undefined);
        query += ' AND device_signature = ?';
        params.push(sig);
      }

      query += ' ORDER BY last_used_at DESC LIMIT ?';
      params.push(limit);

      const [rows] = await conn.execute(query, params);
      return NextResponse.json({
        success: true,
        data: rows,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('[AI Learning] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 保存学习记忆
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientName, deviceName, useYears, deviceConfig, deviceConfigs, action } = body;

    // 支持批量保存多设备配置
    if (deviceConfigs && Array.isArray(deviceConfigs) && deviceConfigs.length > 0) {
      const conn = await pool.getConnection();
      try {
        const results = [];
        for (const config of deviceConfigs) {
          const sig = buildDeviceSignature(config.deviceName, config.useYears);
          const [existing] = await conn.execute(
            'SELECT id, usage_count FROM ai_learning_memory WHERE client_id = ? AND device_signature = ?',
            [clientId || null, sig]
          );

          if ((existing as any[]).length > 0) {
            await conn.execute(
              'UPDATE ai_learning_memory SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP, device_config = ? WHERE id = ?',
              [JSON.stringify(config), (existing as any[])[0].id]
            );
            results.push({ deviceName: config.deviceName, action: 'updated' });
          } else {
            await conn.execute(
              'INSERT INTO ai_learning_memory (client_id, client_name, device_signature, device_config) VALUES (?, ?, ?, ?)',
              [clientId || null, clientName, sig, JSON.stringify(config)]
            );
            results.push({ deviceName: config.deviceName, action: 'inserted' });
          }
        }

        return NextResponse.json({ success: true, results });
      } finally {
        conn.release();
      }
    }

    if (!clientName || !deviceName || !deviceConfig) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const signature = buildDeviceSignature(deviceName, useYears);

    const conn = await pool.getConnection();
    try {
      // 检查是否已存在
      const [existing] = await conn.execute(
        'SELECT id, usage_count FROM ai_learning_memory WHERE client_id = ? AND device_signature = ?',
        [clientId || null, signature]
      );

      if ((existing as any[]).length > 0) {
        // 更新使用次数
        await conn.execute(
          'UPDATE ai_learning_memory SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP, device_config = ? WHERE id = ?',
          [JSON.stringify(deviceConfig), (existing as any[])[0].id]
        );
      } else {
        // 插入新记录
        await conn.execute(
          'INSERT INTO ai_learning_memory (client_id, client_name, device_signature, device_config) VALUES (?, ?, ?, ?)',
          [clientId || null, clientName, signature, JSON.stringify(deviceConfig)]
        );
      }

      return NextResponse.json({ success: true });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('[AI Learning] 保存失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
