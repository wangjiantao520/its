import { NextRequest, NextResponse } from 'next/server';
import { handleLogin, handleLogout, getSessionUser } from '@/lib/auth';

// 登录接口
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await handleLogin(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
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

  return NextResponse.json(result);
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
