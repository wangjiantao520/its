import * as XLSX from 'xlsx';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type FileExtractResult =
  | { ok: true; content: string; label: string }
  | { ok: false; error: string };

/**
 * 从上传文件中提取可发给 AI 的文本内容。
 * 支持 txt/csv/md（直接读文本）与 xlsx/xls（转成表格文本）。
 */
export async function extractFileContent(file: File): Promise<FileExtractResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: '文件过大，请上传 5MB 以内的文件' };
  }

  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return { ok: false, error: 'Excel 中没有工作表' };
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const lines = rows
        .map((row) => row.map((cell) => String(cell ?? '').trim()).join('\t'))
        .filter((line) => line.trim() !== '')
        .join('\n');
      if (!lines) return { ok: false, error: 'Excel 内容为空' };
      return { ok: true, content: lines, label: file.name };
    } catch (error) {
      return { ok: false, error: 'Excel 解析失败：' + (error instanceof Error ? error.message : String(error)) };
    }
  }

  if (name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.md') || name.endsWith('.json')) {
    try {
      const text = await file.text();
      if (!text.trim()) return { ok: false, error: '文件内容为空' };
      return { ok: true, content: text, label: file.name };
    } catch (error) {
      return { ok: false, error: '文件读取失败：' + (error instanceof Error ? error.message : String(error)) };
    }
  }

  return { ok: false, error: '不支持的文件类型，请上传 txt/csv/md/xlsx 文件' };
}

/** 拼接带文件内容的用户消息（截断到 chat 接口上限内） */
export function buildFilePrompt(fileName: string, content: string): string {
  const MAX_MESSAGE_CHARS = 90_000;
  const safeContent = content.length > MAX_MESSAGE_CHARS
    ? content.slice(0, MAX_MESSAGE_CHARS) + '\n...[内容已截断]'
    : content;
  return `【上传文件 ${fileName} 的内容】\n${safeContent}\n\n请分析以上文件内容，并给出回答。`;
}
