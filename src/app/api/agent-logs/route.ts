import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { serializeAssistantRow } from '@/lib/assistant-db';
import { getDatabase } from '@/lib/database/client';
import { validateQuery } from '@/lib/api-validate';

const querySchema = z.object({ agent_id: z.string().regex(/^[1-9]\d*$/) });

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = validateQuery(request, querySchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await getDatabase().query<Record<string, unknown>>(`
      SELECT l.id, l.session_id, l.user_message, l.agent_response,
             l.actions_executed, l.created_at,
             COALESCE(u.name, s.user_name, '未知用户') AS user_name
      FROM agent_logs l
      INNER JOIN agent_sessions s ON s.session_id=l.session_id AND s.is_deleted=false
      LEFT JOIN users u ON u.id=l.user_id
      WHERE l.agent_id=$1
        AND (l.user_id=s.user_id OR (l.user_id IS NULL AND s.user_id IS NULL))
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT 100
    `, [parsed.data.agent_id]);
    return NextResponse.json({ success: true, data: result.rows.map(serializeAssistantRow) });
  } catch (error) {
    console.error('获取对话日志失败:', error);
    return NextResponse.json({ success: false, error: '获取对话日志失败' }, { status: 500 });
  }
}
