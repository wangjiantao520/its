export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function readApiResponse<T = unknown>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      success: false,
      error: response.ok
        ? '服务器返回格式异常'
        : `服务器暂时不可用（${response.status}）`,
    };
  }

  try {
    const payload = await response.json() as unknown;
    if (!payload || typeof payload !== 'object' || !('success' in payload)) {
      return { success: false, error: '服务器返回格式异常' };
    }
    return payload as ApiResponse<T>;
  } catch {
    return { success: false, error: '服务器返回格式异常' };
  }
}
