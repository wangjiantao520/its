import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// POST /api/auth/login - 用户登录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    // 查询用户
    const [users] = await pool.execute(
      'SELECT id, username, real_name, phone, email, role, is_active FROM users WHERE username = ? AND password = ? AND is_active = 1',
      [username, password]
    );

    const userList = users as any[];
    if (userList.length === 0) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const user = userList[0];

    // 返回用户信息（不包含密码）
    return NextResponse.json({
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        phone: user.phone,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
