import { NextResponse } from 'next/server';
import { initDatabase, testConnection } from '@/lib/db';

export async function GET() {
  try {
    // 测试连接
    const connected = await testConnection();
    if (!connected) {
      return NextResponse.json({
        success: false,
        message: '数据库连接失败，请检查数据库配置'
      }, { status: 500 });
    }

    // 初始化数据库
    const initialized = await initDatabase();
    if (!initialized) {
      return NextResponse.json({
        success: false,
        message: '数据库初始化失败'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '数据库初始化成功！'
    });
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return NextResponse.json({
      success: false,
      message: '数据库初始化失败',
      error: String(error)
    }, { status: 500 });
  }
}
