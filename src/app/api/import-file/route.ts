import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { importDevices, parseDeviceRows } from './import-devices';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const supportedExtensions = /\.(?:xlsx|xls)$/i;

function uploadError(message: string): Response {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return uploadError('无法读取上传文件');
  }
  const entry = formData.get('file');
  if (!(entry instanceof File)) return uploadError('请选择文件');
  if (!supportedExtensions.test(entry.name)) return uploadError('仅支持 .xlsx 或 .xls 文件');
  if (entry.size === 0) return uploadError('上传文件为空');
  if (entry.size > MAX_UPLOAD_BYTES) return uploadError('文件不能超过 10MB');

  let devices;
  try {
    const workbook = XLSX.read(await entry.arrayBuffer(), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return uploadError('工作簿中没有工作表');
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
    });
    devices = parseDeviceRows(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : '文件格式无效';
    return uploadError(`文件解析失败：${message}`);
  }
  if (devices.length === 0) return uploadError('未解析到有效的设备数据');

  try {
    const { imported, updated } = await importDevices(getDatabase(), devices);
    return NextResponse.json({
      success: true,
      imported,
      updated,
      total: devices.length,
      message: `导入成功：新增 ${imported} 条，更新 ${updated} 条`,
    });
  } catch (error) {
    console.error('Import file error:', error);
    return NextResponse.json({ success: false, error: '导入失败' }, { status: 500 });
  }
}
