import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';

// GET /api/agents/[id]/skills - 获取智能体技能列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM agent_skills WHERE agent_id = ? ORDER BY priority DESC',
      [id]
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取技能列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取技能列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/skills - 添加技能
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  
  try {
    const body = await request.json();
    const { skill_name, skill_type, config_json, enabled, priority } = body;

    if (!skill_name || !skill_type) {
      return NextResponse.json(
        { success: false, error: '技能名称和类型不能为空' },
        { status: 400 }
      );
    }

    await pool.execute(
      `INSERT INTO agent_skills (agent_id, skill_name, skill_type, config_json, enabled, priority)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, skill_name, skill_type, config_json || '{}', enabled !== undefined ? enabled : 1, priority || 0]
    );

    return NextResponse.json({ success: true, data: { message: '技能添加成功' } }, { status: 201 });
  } catch (error) {
    console.error('添加技能失败:', error);
    return NextResponse.json(
      { success: false, error: '添加技能失败' },
      { status: 500 }
    );
  }
}

// PUT /api/agents/[id]/skills - 更新技能
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  
  try {
    const body = await request.json();
    const { skill_id, skill_name, skill_type, config_json, enabled, priority } = body;

    if (!skill_id) {
      return NextResponse.json(
        { success: false, error: '技能ID不能为空' },
        { status: 400 }
      );
    }

    await pool.execute(
      `UPDATE agent_skills 
       SET skill_name = ?, skill_type = ?, config_json = ?, enabled = ?, priority = ?
       WHERE id = ? AND agent_id = ?`,
      [skill_name, skill_type, config_json || '{}', enabled !== undefined ? enabled : 1, priority || 0, skill_id, id]
    );

    return NextResponse.json({ success: true, data: { message: '技能更新成功' } });
  } catch (error) {
    console.error('更新技能失败:', error);
    return NextResponse.json(
      { success: false, error: '更新技能失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]/skills - 删除技能
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  
  try {
    const { searchParams } = new URL(request.url);
    const skill_id = searchParams.get('skill_id');

    if (!skill_id) {
      return NextResponse.json(
        { success: false, error: '技能ID不能为空' },
        { status: 400 }
      );
    }

    await pool.execute('DELETE FROM agent_skills WHERE id = ? AND agent_id = ?', [skill_id, id]);

    return NextResponse.json({ success: true, data: { message: '技能删除成功' } });
  } catch (error) {
    console.error('删除技能失败:', error);
    return NextResponse.json(
      { success: false, error: '删除技能失败' },
      { status: 500 }
    );
  }
}
