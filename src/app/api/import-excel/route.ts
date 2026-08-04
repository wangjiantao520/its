import { Config, FetchClient, HeaderUtils } from 'coze-coding-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import {
  importDevices,
  parseDelimitedDeviceText,
} from '@/app/api/import-file/import-devices';

function validationError(error: string): Response {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError('请提供有效的 JSON 请求');
  }
  if (typeof body !== 'object' || body === null || !('url' in body)) {
    return validationError('请提供文件URL');
  }
  const url = body.url;
  if (typeof url !== 'string' || !url.trim()) return validationError('请提供文件URL');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return validationError('无效的URL格式');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return validationError('仅支持 http/https 协议');
  }

  try {
    const client = new FetchClient(
      new Config(),
      HeaderUtils.extractForwardHeaders(request.headers),
    );
    const response = await client.fetch(parsedUrl.toString());
    if (response.status_code !== 0) {
      return NextResponse.json({
        success: false,
        error: '文件解析失败',
        message: response.status_message,
      }, { status: 400 });
    }
    const textContent = response.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n');
    let devices;
    try {
      devices = parseDelimitedDeviceText(textContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : '文件内容无效';
      return validationError(`文件解析失败：${message}`);
    }
    if (devices.length === 0) return validationError('未解析到有效的设备数据');

    const { imported, updated } = await importDevices(getDatabase(), devices);
    return NextResponse.json({
      success: true,
      message: `导入完成：新增 ${imported} 条，更新 ${updated} 条`,
      imported,
      updated,
      total: devices.length,
    });
  } catch (error) {
    console.error('导入失败:', error);
    return NextResponse.json({
      success: false,
      error: '导入失败',
      message: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
