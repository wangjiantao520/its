import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

interface SessionRow {
  session_id: string;
  user_id: number | null;
  agent_id: number | null;
  title: string;
  created_at: string;
}

interface LogRow {
  user_message: string;
  agent_response: string;
  created_at: string;
}

function canAccess(session: SessionRow, role: string, userId?: number): boolean {
  return role === 'admin' || session.user_id === (userId ?? -1);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { sessionId } = await params;
    const session = db.prepare(`
      SELECT session_id, user_id, agent_id, title, created_at
      FROM agent_sessions
      WHERE session_id = ? AND is_deleted = 0
    `).get(sessionId) as SessionRow | undefined;

    if (!session) {
      return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
    }
    if (!canAccess(session, auth.session.role, auth.session.userId)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    const logs = db.prepare(`
      SELECT user_message, agent_response, created_at
      FROM agent_logs
      WHERE session_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(sessionId) as LogRow[];

    return NextResponse.json({
      success: true,
      data: {
        session: {
          session_id: session.session_id,
          title: session.title,
          agent_id: session.agent_id,
          created_at: session.created_at,
        },
        messages: logs.flatMap((log) => [
          { role: 'user' as const, content: log.user_message, timestamp: log.created_at },
          { role: 'assistant' as const, content: log.agent_response, timestamp: log.created_at },
        ]),
      },
    });
  } catch (error) {
    console.error('获取会话详情失败:', error);
    return NextResponse.json({ success: false, error: '获取会话详情失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { sessionId } = await params;
    const session = db.prepare(`
      SELECT session_id, user_id, agent_id, title, created_at
      FROM agent_sessions
      WHERE session_id = ? AND is_deleted = 0
    `).get(sessionId) as SessionRow | undefined;
    if (!session) {
      return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
    }
    if (!canAccess(session, auth.session.role, auth.session.userId)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    db.prepare(`
      UPDATE agent_sessions
      SET is_deleted = 1, updated_at = datetime('now')
      WHERE session_id = ?
    `).run(sessionId);
    return NextResponse.json({ success: true, data: { message: '删除成功' } });
  } catch (error) {
    console.error('删除会话失败:', error);
    return NextResponse.json({ success: false, error: '删除会话失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { sessionId } = await params;
    const session = db.prepare(`
      SELECT session_id, user_id, agent_id, title, created_at
      FROM agent_sessions
      WHERE session_id = ? AND is_deleted = 0
    `).get(sessionId) as SessionRow | undefined;
    if (!session) {
      return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
    }
    if (!canAccess(session, auth.session.role, auth.session.userId)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    const body = (await request.json()) as { title?: string };
    const title = body.title?.trim().slice(0, 100) || '新会话';
    db.prepare(`
      UPDATE agent_sessions
      SET title = ?, updated_at = datetime('now')
      WHERE session_id = ?
    `).run(title, sessionId);
    return NextResponse.json({ success: true, data: { message: '更新成功', title } });
  } catch (error) {
    console.error('更新会话失败:', error);
    return NextResponse.json({ success: false, error: '更新会话失败' }, { status: 500 });
  }
}
