import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/agents - 获取智能体列表
export async function GET() {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM agent_configs ORDER BY created_at DESC'
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('获取智能体列表失败:', error);
    return NextResponse.json(
      { error: '获取智能体列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/agents - 创建智能体
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, system_prompt, model, temperature, enabled } = body;

    if (!name || !system_prompt) {
      return NextResponse.json(
        { error: '名称和系统提示词不能为空' },
        { status: 400 }
      );
    }

    await pool.execute(
      `INSERT INTO agent_configs (name, description, system_prompt, model, temperature, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || '', system_prompt, model || 'doubao-seed-1-8-251228', temperature || 0.7, enabled !== undefined ? enabled : 1]
    );

    return NextResponse.json({ message: '智能体创建成功' }, { status: 201 });
  } catch (error) {
    console.error('创建智能体失败:', error);
    return NextResponse.json(
      { error: '创建智能体失败' },
      { status: 500 }
    );
  }
}

// PUT /api/agents - 更新智能体
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, system_prompt, model, temperature, enabled } = body;

    if (!id) {
      return NextResponse.json(
        { error: '智能体ID不能为空' },
        { status: 400 }
      );
    }

    await pool.execute(
      `UPDATE agent_configs 
       SET name = ?, description = ?, system_prompt = ?, model = ?, temperature = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, description || '', system_prompt, model || 'doubao-seed-1-8-251228', temperature || 0.7, enabled !== undefined ? enabled : 1, id]
    );

    return NextResponse.json({ message: '智能体更新成功' });
  } catch (error) {
    console.error('更新智能体失败:', error);
    return NextResponse.json(
      { error: '更新智能体失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents - 删除智能体
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '智能体ID不能为空' },
        { status: 400 }
      );
    }

    // 先删除关联的技能和知识库
    await pool.execute('DELETE FROM agent_skills WHERE agent_id = ?', [id]);
    await pool.execute('DELETE FROM agent_knowledge_base WHERE agent_id = ?', [id]);
    await pool.execute('DELETE FROM agent_configs WHERE id = ?', [id]);

    return NextResponse.json({ message: '智能体删除成功' });
  } catch (error) {
    console.error('删除智能体失败:', error);
    return NextResponse.json(
      { error: '删除智能体失败' },
      { status: 500 }
    );
  }
}
