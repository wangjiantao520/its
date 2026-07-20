import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';

interface AgentSessionRow {
  session_id: string;
  title: string;
  last_message: string | null;
  agent_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const agentId = new URL(request.url).searchParams.get('agent_id');
    let query = `
      SELECT session_id, title, last_message, agent_id, created_at, updated_at
      FROM agent_sessions
      WHERE is_deleted = 0
    `;
    const params: Array<string | number> = [];

    if (auth.session.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(auth.session.userId ?? 0);
    }
    if (agentId) {
      query += ' AND agent_id = ?';
      params.push(agentId);
    }
    query += ' ORDER BY updated_at DESC';

    const sessions = db.prepare(query).all(...params) as AgentSessionRow[];
    return NextResponse.json({
      success: true,
      data: {
        list: sessions.map((session) => ({
          session_id: session.session_id,
          title: session.title,
          last_message: session.last_message || '',
          agent_id: session.agent_id,
          created_at: session.created_at,
          updated_at: session.updated_at,
        })),
      },
    });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return NextResponse.json({ success: false, error: '获取会话列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as { agent_id?: number; title?: string };
    const sessionId = `sess_${crypto.randomUUID()}`;
    const title = body.title?.trim().slice(0, 100) || '新会话';
    db.prepare(`
      INSERT INTO agent_sessions
        (session_id, user_id, user_name, agent_id, title, is_deleted, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `).run(
      sessionId,
      auth.session.userId ?? null,
      auth.session.name || auth.session.username || '',
      body.agent_id ?? 1,
      title,
    );

    return NextResponse.json(
      { success: true, data: { session_id: sessionId, title } },
      { status: 201 },
    );
  } catch (error) {
    console.error('创建会话失败:', error);
    return NextResponse.json({ success: false, error: '创建会话失败' }, { status: 500 });
  }
}
