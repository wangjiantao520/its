/**
 * API 输入校验工具
 *
 * 用法：
 *   import { z } from 'zod';
 *   import { validateBody, validateQuery } from '@/lib/api-validate';
 *
 *   const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() });
 *   const parsed = await validateBody(request, schema);
 *   if (!parsed.ok) return parsed.response;
 *   // 使用 parsed.data.name, parsed.data.age
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * 校验请求体（JSON）
 * 成功返回 { ok: true, data }，失败返回 { ok: false, response: 400 }
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            error: '输入参数校验失败',
            details: result.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
          { status: 400 },
        ),
      };
    }
    return { ok: true, data: result.data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '请求体不是有效的 JSON' },
        { status: 400 },
      ),
    };
  }
}

/**
 * 校验 query 参数（字符串）
 * 注意：query 参数都是字符串，schema 应使用 z.string() 或 z.coerce.number() 等
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
): ValidationResult<T> {
  const { searchParams } = new URL(request.url);
  const params: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: '查询参数校验失败',
          details: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: result.data };
}
