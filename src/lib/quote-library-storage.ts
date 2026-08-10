/**
 * 报价资料库文件存储工具。
 *
 * 物理路径：public/uploads/quote-library/<library_id>/<category>/<timestamp>-<rand>-<safe-name>
 * 公开 URL：/uploads/quote-library/<library_id>/<category>/<...>
 *
 * 之所以放在 public/ 下，是因为 Next.js 默认会把 public/ 内的文件暴露为静态资源；
 * 这样无须额外配置就能在浏览器里直接预览/下载图片和附件。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { QuoteLibraryAttachmentCategory } from './quote-library-types';

const PUBLIC_DIRNAME = 'public';
const UPLOAD_PREFIX = ['uploads', 'quote-library'] as const;

/** 文件名净化：保留中英文、数字、常用符号，其余替换为下划线 */
export function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || 'file';
  // 仅保留中英文、数字、点、连字符、下划线、圆括号与中文括号
  const replaced = trimmed
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_');
  // 控制长度，避免极端长文件名
  return replaced.length > 80 ? replaced.slice(0, 80) : replaced;
}

/** 生成时间戳 + 6 位随机串的存储文件名 */
export function buildStoredName(originalName: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = sanitizeFileName(originalName);
  return `${ts}-${rand}-${safe}`;
}

/** public 目录绝对路径 */
export function publicDir(): string {
  return path.resolve(process.cwd(), PUBLIC_DIRNAME);
}

/** 解析上传目录绝对路径 */
export function uploadsDir(...segments: string[]): string {
  return path.join(publicDir(), ...UPLOAD_PREFIX, ...segments);
}

/** 公开访问 URL（相对域名） */
export function uploadsPublicUrl(...segments: string[]): string {
  return ['/', ...UPLOAD_PREFIX, ...segments].map((s) => encodeURIComponent(s).replace(/%2F/g, '/')).join('/');
}

/** 把存储相对路径转换为 public URL */
export function toPublicUrl(storedPath: string): string {
  // storedPath 形如 "uploads/quote-library/<id>/<category>/<filename>"
  const normalized = storedPath.replace(/\\/g, '/').replace(/^\/+/, '');
  return '/' + normalized;
}

/** 确保目录存在（递归 mkdir） */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** 写入文件 */
export async function writeFile(target: string, data: Buffer | Uint8Array): Promise<void> {
  await ensureDir(path.dirname(target));
  await fs.writeFile(target, data);
}

/**
 * 安全删除文件：失败仅返回 false，不抛错（主流程不应被文件清理阻塞）。
 */
export async function safeUnlink(target: string): Promise<boolean> {
  try {
    await fs.unlink(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * 解析存储路径到绝对路径。
 * 仅允许 uploads/quote-library/ 下的路径，防止越权访问其他目录。
 */
export function resolveSafeAbsolutePath(storedPath: string): string | null {
  const normalized = storedPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith([...UPLOAD_PREFIX].join('/') + '/')) return null;
  const abs = path.join(publicDir(), normalized);
  const root = path.join(publicDir(), ...UPLOAD_PREFIX);
  // 防止 ../ 越权
  if (!abs.startsWith(root)) return null;
  return abs;
}

/** 构造相对存储路径 */
export function buildStoredPath(
  libraryId: string | number,
  category: QuoteLibraryAttachmentCategory,
  storedName: string,
): string {
  return [...UPLOAD_PREFIX, String(libraryId), category, storedName].join('/');
}