import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { serializeAssistantRow, serializeTimestamp } from '@/lib/assistant-db';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';
import { validateBody } from '@/lib/api-validate';

interface RouteParams { params: Promise<{ sessionId: string }> }
interface SessionRow extends Record<string, unknown> {
  session_id: string;
  user_id: string | number | bigint | null;
  user_name: string | null;
  agent_id: string | number | bigint | null;
  title: string;
  created_at: string | Date;
}

const titleSchema = z.object({ title: z.string().trim().min(1).max(100) });

function validSessionId(value: string): string | null {
  return /^sess_[A-Za-z0-9_-]{1,100}$/.test(value) ? value : null;
}

function ownsSession(
  session: SessionRow,
  role: string,
  userId?: number,
  username?: string,
  name?: string,
): boolean {
  if (role === 'admin') return true;
  if (userId === undefined) return false;
  if (userId > 0) return String(session.user_id) === String(userId);
  return session.user_id === null && session.user_name === (username || name || '');
}

async function findSession(database: DatabaseClient, sessionId: string, lock = false): Promise<SessionRow | null> {
  const result = await database.query<SessionRow>(`
    SELECT session_id, user_id, user_name, agent_id, title, created_at
    FROM agent_sessions
    WHERE session_id=$1 AND is_deleted=false${lock ? ' FOR UPDATE' : ''}
  `, [sessionId]);
  return result.rows[0] ?? null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const sessionId = validSessionId((await params).sessionId);
  if (!sessionId) return NextResponse.json({ success: false, error: '无效的会话ID' }, { status: 400 });
  try {
    const database = getDatabase();
    const session = await findSession(database, sessionId);
    if (!session) return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
    if (!ownsSession(session, auth.session.role, auth.session.userId, auth.session.username, auth.session.name)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }
    const logs = await database.query<Record<string, unknown>>(`
      SELECT user_message, agent_response, actions_executed, created_at
      FROM agent_logs
      WHERE session_id=$1 AND user_id IS NOT DISTINCT FROM $2
      ORDER BY created_at ASC, id ASC
    `, [sessionId, session.user_id]);
    return NextResponse.json({
      success: true,
      data: {
        session: serializeAssistantRow({
          session_id: session.session_id,
          title: session.title,
          agent_id: session.agent_id,
          created_at: session.created_at,
        }),
        messages: logs.rows.flatMap((log) => [
          { role: 'user' as const, content: String(log.user_message), timestamp: serializeTimestamp(log.created_at) },
          { role: 'assistant' as const, content: String(log.agent_response), timestamp: serializeTimestamp(log.created_at) },
        ]),
      },
    });
  } catch (error) {
    console.error('获取会话详情失败:', error);
    return NextResponse.json({ success: false, error: '获取会话详情失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const sessionId = validSessionId((await params).sessionId);
  if (!sessionId) return NextResponse.json({ success: false, error: '无效的会话ID' }, { status: 400 });
  try {
    const outcome = await getDatabase().transaction(async (database) => {
      const session = await findSession(database, sessionId, true);
      if (!session) return 'missing' as const;
      if (!ownsSession(session, auth.session.role, auth.session.userId, auth.session.username, auth.session.name)) return 'forbidden' as const;
      await database.query('UPDATE agent_sessions SET is_deleted=true, updated_at=now() WHERE session_id=$1 RETURNING session_id', [sessionId]);
      return 'deleted' as const;
    });
    if (outcome === 'missing') return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
    if (outcome === 'forbidden') return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    return NextResponse.json({ success: true, data: { message: '删除成功' } });
  } catch (error) {
    console.error('删除会话失败:', error);
    return NextResponse.json({ success: false, error: '删除会话失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const sessionId = validSessionId((await params).sessionId);
  if (!sessionId) return NextResponse.json({ success: false, error: '无效的会话ID' }, { status: 400 });
  const parsed = await validateBody(request, titleSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const outcome = await getDatabase().transaction(async (database) => {
      const session = await findSession(database, sessionId, true);
      if (!session) return 'missing' as const;
      if (!ownsSession(session, auth.session.role, auth.session.userId, auth.session.username, auth.session.name)) return 'forbidden' as const;
      await database.query('UPDATE agent_sessions SET title=$1, updated_at=now() WHERE session_id=$2 RETURNING session_id', [parsed.data.title, sessionId]);
      return 'updated' as const;
    });
    if (outcome === 'missing') return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
    if (outcome === 'forbidden') return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    return NextResponse.json({ success: true, data: { message: '更新成功', title: parsed.data.title } });
  } catch (error) {
    console.error('更新会话失败:', error);
    return NextResponse.json({ success: false, error: '更新会话失败' }, { status: 500 });
  }
}
