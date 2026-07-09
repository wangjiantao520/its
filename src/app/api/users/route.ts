import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/users - 获取所有用户
export async function GET(request: NextRequest) {
  try {
    const [users] = await pool.execute(
      'SELECT id, username, real_name, phone, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    return NextResponse.json(users);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}

// POST /api/users - 创建用户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, real_name, phone, email, role } = body;

    if (!username || !password || !real_name) {
      return NextResponse.json({ error: '用户名、密码和真实姓名不能为空' }, { status: 400 });
    }

    // 检查用户名是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if ((existing as any[]).length > 0) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
    }

    // 创建用户
    await pool.execute(
      'INSERT INTO users (username, password, real_name, phone, email, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, password, real_name, phone || null, email || null, role || 'member']
    );

    return NextResponse.json({ message: '用户创建成功' }, { status: 201 });
  } catch (error) {
    console.error('创建用户失败:', error);
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
  }
}

// PUT /api/users - 更新用户
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, username, real_name, phone, email, role, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    await pool.execute(
      'UPDATE users SET username = ?, real_name = ?, phone = ?, email = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [username, real_name, phone || null, email || null, role, is_active, id]
    );

    return NextResponse.json({ message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 });
  }
}

// DELETE /api/users - 删除用户
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);

    return NextResponse.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 });
  }
}
