import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

interface ParameterRow extends Record<string, unknown> {
  key: string;
  value: string;
}

const parametersSchema = z.record(z.string().min(1).max(100), z.string().max(1000));

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const rows = await getDatabase().query<ParameterRow>(
      'SELECT key, value FROM system_parameters ORDER BY key',
    );
    const parameters: Record<string, string> = {};
    for (const row of rows.rows) parameters[row.key] = row.value;
    return NextResponse.json({ success: true, data: parameters });
  } catch (error) {
    console.error('获取系统参数失败:', error);
    return NextResponse.json({ success: false, error: '获取系统参数失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是有效的 JSON' }, { status: 400 });
  }
  const parsed = parametersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: '参数格式无效' }, { status: 400 });
  }

  try {
    const database = getDatabase();
    const entries = Object.entries(parsed.data);
    for (const [key, value] of entries) {
      await database.query(
        `INSERT INTO system_parameters (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, value],
      );
    }
    return NextResponse.json({ success: true, message: `已保存 ${entries.length} 项系统参数` });
  } catch (error) {
    console.error('保存系统参数失败:', error);
    return NextResponse.json({ success: false, error: '保存系统参数失败' }, { status: 500 });
  }
}
