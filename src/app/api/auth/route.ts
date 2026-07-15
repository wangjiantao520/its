import { NextRequest, NextResponse } from 'next/server';
import { handleLogin, handleLogout, getSessionUser } from '@/lib/auth';
import { SESSION_COOKIE_NAME } from '@/lib/request-session-token';

// 登录接口
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await handleLogin(body);

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
