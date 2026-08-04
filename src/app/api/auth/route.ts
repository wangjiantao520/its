import { NextRequest, NextResponse } from 'next/server';
import { handleLogin, handleLogout, getSessionUser } from '@/lib/auth';
import { SESSION_COOKIE_NAME } from '@/lib/request-session-token';
import { validateBody } from '@/lib/api-validate';
import { z } from 'zod';

const loginSchema = z.object({
  role: z.enum(['admin', 'its_member']).optional(),
  username: z.string().min(1, '用户名不能为空').max(100).optional(),
  password: z.string().min(1, '密码不能为空').max(200),
  remember: z.boolean().optional(),
}).refine((data) => data.role === 'admin' || Boolean(data.username), {
  path: ['username'],
  message: '用户名不能为空',
});

// 登录接口
export async function POST(request: NextRequest) {
  const parsed = await validateBody(request, loginSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await handleLogin(parsed.data);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    const response = NextResponse.json(result);
    if (result.data) {
      response.cookies.set(SESSION_COOKIE_NAME, result.data.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: Math.max(0, Math.floor((result.data.expiresAt - Date.now()) / 1000)),
      });
    }
    return response;
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json(
      { success: false, error: '登录失败' },
      { status: 500 }
    );
  }
}

// 登出接口
export async function DELETE(request: NextRequest) {
  const result = handleLogout(request);

  if (!result.success) {
    return NextResponse.json(result, { status: 401 });
  }

  const response = NextResponse.json(result);
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

// 获取当前会话信息
export async function GET(request: NextRequest) {
  const session = getSessionUser(request);

  if (!session) {
    return NextResponse.json(
      { success: false, error: '未登录' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: session
  });
}
