import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';

interface AgentLogRow {
  id: number;
  session_id: string;
  user_message: string;
  agent_response: string;
  actions_executed: string | null;
  created_at: string;
  user_name: string | null;
}

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const agentId = Number(new URL(request.url).searchParams.get('agent_id'));
  if (!Number.isInteger(agentId) || agentId <= 0) {
    return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  }
  const rows = db.prepare(`
    SELECT l.id, l.session_id, l.user_message, l.agent_response,
           l.actions_executed, l.created_at,
           COALESCE(u.name, s.user_name, '未知用户') AS user_name
    FROM agent_logs l
    LEFT JOIN users u ON u.id = l.user_id
    LEFT JOIN agent_sessions s ON s.session_id = l.session_id
    WHERE l.agent_id = ?
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT 100
  `).all(agentId) as AgentLogRow[];
  return NextResponse.json({ success: true, data: rows });
}
