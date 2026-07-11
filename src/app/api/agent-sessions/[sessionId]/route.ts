import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { sessionId } = await params;

    // 校验会话归属
    const session = db.prepare(
      'SELECT id, session_id, user_id, agent_id, title FROM agent_sessions WHERE session_id = ? AND is_deleted = 0'
    ).get(sessionId) as any;

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    // 只能查看自己的会话
    if (user.role !== 'admin' && session.user_id !== user.userId) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }

    // 获取会话消息
    const messages = db.prepare(
      `SELECT id, role, content, created_at 
       FROM agent_logs 
       WHERE session_id = ? 
       ORDER BY created_at ASC, id ASC`
    ).all(sessionId);

    return NextResponse.json({
      success: true,
      data: {
        session: {
          sessionId: session.session_id,
          title: session.title,
          agentId: session.agent_id,
          createdAt: session.created_at,
        },
        messages: messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('获取会话详情失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { sessionId } = await params;

    // 校验会话归属
    const session = db.prepare(
      'SELECT id, user_id FROM agent_sessions WHERE session_id = ? AND is_deleted = 0'
    ).get(sessionId) as any;

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    // 只能删除自己的会话
    if (user.role !== 'admin' && session.user_id !== user.userId) {
      return NextResponse.json({ error: '无权删除' }, { status: 403 });
    }

    // 软删除
    db.prepare(
      'UPDATE agent_sessions SET is_deleted = 1, updated_at = datetime(\'now\') WHERE session_id = ?'
    ).run(sessionId);

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除会话失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await request.json();
    const { title } = body;

    // 校验会话归属
    const session = db.prepare(
      'SELECT id, user_id FROM agent_sessions WHERE session_id = ? AND is_deleted = 0'
    ).get(sessionId) as any;

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    // 只能修改自己的会话
    if (user.role !== 'admin' && session.user_id !== user.userId) {
      return NextResponse.json({ error: '无权修改' }, { status: 403 });
    }

    db.prepare(
      'UPDATE agent_sessions SET title = ?, updated_at = datetime(\'now\') WHERE session_id = ?'
    ).run(title || '新会话', sessionId);

    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新会话失败:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
