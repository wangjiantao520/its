import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { db } from '@/lib/db';

// GET: 获取当前用户的会话列表
export async function GET(request: NextRequest) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    let query = 'SELECT session_id, title, agent_id, created_at, updated_at FROM agent_sessions WHERE is_deleted = 0';
    const params: (string | number)[] = [];

    // 普通用户只能看自己的
    if (user.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(String(user.userId));
    }

    if (agentId) {
      query += ' AND agent_id = ?';
      params.push(agentId);
    }

    query += ' ORDER BY updated_at DESC';

    const sessions = db.prepare(query).all(...params) as any[];

    return NextResponse.json({
      success: true,
      data: sessions.map(s => ({
        sessionId: s.session_id,
        title: s.title,
        agentId: s.agent_id,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
    });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST: 创建新会话
export async function POST(request: NextRequest) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { agentId, title } = body;

    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    db.prepare(
      `INSERT INTO agent_sessions 
       (session_id, user_id, user_name, agent_id, agent_name, title, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
    ).run(
      sessionId,
      user.userId,
      user.name || user.username,
      agentId || 'default',
      '',
      title || '新会话'
    );

    return NextResponse.json({
      success: true,
      data: { sessionId, title: title || '新会话' },
    });
  } catch (error) {
    console.error('创建会话失败:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
