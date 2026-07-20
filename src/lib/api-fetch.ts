/**
 * 统一的 API 请求工具函数
 *
 * 解决问题：
 * 1. 当服务端返回 401/403 等非 JSON 响应时，res.json() 会抛错导致页面卡死
 * 2. 统一处理认证头，避免每个地方手动拼接 Bearer token
 * 3. 未登录时自动跳转到登录页，而不是让请求失败
 */

interface ApiFetchOptions extends RequestInit {
  // 是否在未登录时自动跳转登录页（默认 true）
  autoRedirectOnAuth?: boolean;
}

interface ApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

/**
 * 获取认证头
 * 优先从 localStorage 读取 token，同时也依赖 cookie（后端会自动读取）
 */
function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * 安全的 JSON 解析：如果响应不是 JSON（比如 HTML 错误页），返回 null 而不是抛错
 */
async function safeJsonResponse(response: Response): Promise<any | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // 不是 JSON，可能是 HTML 错误页
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 统一的 API 请求函数
 *
 * 特性：
 * - 自动携带认证头（Bearer token + cookie 双保险）
 * - 响应不是 JSON 时不会崩溃
 * - 401 时自动跳转登录页（可选）
 * - 返回标准化的结果对象
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<ApiResult<T>> {
  const { autoRedirectOnAuth = true, headers, ...restOptions } = options;

  // 合并认证头
  const authHeaders = getAuthHeaders();
  const finalHeaders: HeadersInit = {
    ...(headers as Record<string, string>),
    ...(authHeaders as Record<string, string>),
  };

  // 如果有 body 且是 JSON，自动设置 Content-Type
  if (restOptions.body && typeof restOptions.body === 'string' && !finalHeaders['Content-Type']) {
    (finalHeaders as Record<string, string>)['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: finalHeaders,
      credentials: 'include', // 确保携带 cookie
    });

    // 处理认证失败
    if (response.status === 401) {
      if (autoRedirectOnAuth && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath !== '/login') {
          window.location.href = '/login';
        }
      }
      return { success: false, error: '未登录或登录已过期', status: 401 };
    }

    // 安全解析 JSON
    const data = await safeJsonResponse(response);

    if (data === null) {
      // 非 JSON 响应
      const text = await response.text().catch(() => '');
      return {
        success: false,
        error: `服务器返回了非JSON响应 (${response.status})`,
        status: response.status,
      };
    }

    return {
      success: data.success ?? response.ok,
      data: data.data,
      error: data.error,
      status: response.status,
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      success: false,
      error: `网络请求失败：${err.message}`,
      status: 0,
    };
  }
}

/**
 * 简化版：只返回 data 或抛错
 * 适用于不需要处理错误细节的场景
 */
export async function apiFetchOrThrow<T = unknown>(url: string, options?: ApiFetchOptions): Promise<T> {
  const result = await apiFetch<T>(url, options);
  if (!result.success) {
    throw new Error(result.error || '请求失败');
  }
  if (result.data === undefined) {
    throw new Error('返回数据为空');
  }
  return result.data;
}
