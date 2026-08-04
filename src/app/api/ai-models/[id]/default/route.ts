import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

interface IdRow extends Record<string, unknown> {
  id: string | number | bigint;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!/^\d+$/.test(id) || BigInt(id) <= BigInt(0)) {
    return NextResponse.json({ success: false, error: '配置ID无效' }, { status: 400 });
  }

  try {
    const selected = await getDatabase().transaction(async (database) => {
      await database.query(
        "SELECT pg_advisory_xact_lock(hashtext('ai_model_configs:state'))",
      );
      const existing = await database.query<IdRow>(
        'SELECT id FROM ai_model_configs WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!existing.rows[0]) return false;

      await database.query('UPDATE ai_model_configs SET is_default = false WHERE is_default = true');
      const updated = await database.query<IdRow>(
        `UPDATE ai_model_configs SET is_default = true, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING id`,
        [id],
      );
      return Boolean(updated.rows[0]);
    });

    if (!selected) {
      return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { message: '已设为默认模型' } });
  } catch (error) {
    console.error('设置默认模型失败:', error);
    return NextResponse.json({ success: false, error: '设置默认模型失败' }, { status: 500 });
  }
}
