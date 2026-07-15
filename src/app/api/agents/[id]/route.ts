import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';

// GET /api/agents/[id] - 获取单个智能体
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM agent_configs WHERE id = ?',
      [id]
    );
    
    if ((rows as any[]).length === 0) {
      return NextResponse.json({ success: false, error: '智能体不存在' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: (rows as any[])[0] });
  } catch (error) {
    console.error('获取智能体失败:', error);
    return NextResponse.json({ success: false, error: '获取智能体失败' }, { status: 500 });
  }
}

// PUT /api/agents/[id] - 更新智能体
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  
  try {
    const body = await request.json();
    const { name, description, system_prompt, model, temperature, enabled } = body;

    if (!name || !system_prompt) {
      return NextResponse.json(
        { success: false, error: '名称和系统提示词不能为空' },
        { status: 400 }
      );
    }

    await pool.execute(
      `UPDATE agent_configs 
       SET name = ?, description = ?, system_prompt = ?, model = ?, temperature = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, description || '', system_prompt, model || 'doubao-seed-1-8-251228', temperature || 0.7, enabled !== undefined ? enabled : 1, id]
    );

    return NextResponse.json({ success: true, data: { message: '智能体更新成功' } });
  } catch (error) {
    console.error('更新智能体失败:', error);
    return NextResponse.json({ success: false, error: '更新智能体失败' }, { status: 500 });
  }
}

// DELETE /api/agents/[id] - 删除智能体
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  
  try {
    // 先删除关联的技能和知识库
    await pool.execute('DELETE FROM agent_skills WHERE agent_id = ?', [id]);
    await pool.execute('DELETE FROM agent_knowledge_base WHERE agent_id = ?', [id]);
    await pool.execute('DELETE FROM agent_configs WHERE id = ?', [id]);

    return NextResponse.json({ success: true, data: { message: '智能体删除成功' } });
  } catch (error) {
    console.error('删除智能体失败:', error);
    return NextResponse.json({ success: false, error: '删除智能体失败' }, { status: 500 });
  }
}
