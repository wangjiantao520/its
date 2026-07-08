// AI辅助报价 - 调用真实DeepSeek API版本
// 类型定义

export type RecognitionStatus = 'idle' | 'recognizing' | 'analyzing' | 'success' | 'needs_info' | 'failed' | 'not_configured';

export interface CandidateDevice {
  id: string;
  name: string;
  category: string;
}

export interface EstimatedPriceRange {
  min: number;
  max: number;
  unit: string;
}

export interface AiDevice {
  rawText: string;
  deviceName?: string;
  model?: string;
  quantity?: number;
  useYears?: number;
  conditionLevel?: number;
  failureRate?: number;
  underWarranty?: boolean;
  needSpareParts?: boolean;
  matchedDeviceId?: string;
  matchedDeviceName?: string;
  confidence: number;
  candidateDeviceIds?: string[];
  candidateDevices?: CandidateDevice[];
  warnings?: string[];
}

export interface AiQuoteDraft {
  customerName?: string;
  projectName?: string;
  region?: "城区" | "市区县城郊区" | "乡镇" | "农村";
  contractYears?: number;
  serviceMode?: "远程" | "驻场" | "混合";
  responseTime?: "10分钟内" | "30分钟内" | "1小时内" | "15分钟内";
  arrivalTime?: "2小时内" | "8小时内" | "4小时" | "24小时";
  serviceTime?: "5x8" | "7x8" | "7x24";
  annualInspectionCount?: number;
  needSpareParts?: boolean;
  notes?: string;
  devices: AiDevice[];
  missingFields: string[];
  suggestions: string[];
  quotaList?: Array<{
    id: string;
    name: string;
    category: string;
    model?: string;
  }>;
  estimatedPriceRange?: EstimatedPriceRange;
  error?: string;
}

// 对话历史记录
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 示例需求
export const AI_QUOTE_EXAMPLES = [
  "城区某单位有1台全新手动装订机，需要一年维保，每季度巡检一次。",
  "某乡镇单位有20台使用3年的台式电脑、2台使用5年的电动装订机，需要一年维保，每季度巡检一次，故障后8小时内到场。",
  "有一批办公设备需要维保。"
];

// 调用真实DeepSeek API的解析器（单次）
export async function parseQuoteRequirement(text: string): Promise<AiQuoteDraft> {
  try {
    const response = await fetch('/api/ai-parse-quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('API调用失败');
    }

    const data = await response.json();
    return data as AiQuoteDraft;
  } catch (error) {
    console.error('AI解析失败:', error);

    return {
      devices: [],
      missingFields: ['服务暂不可用'],
      suggestions: ['AI服务暂时不可用，请检查网络连接后重试'],
      error: '网络错误，请重试'
    };
  }
}

// 调用真实DeepSeek API的解析器（支持多轮对话）
export async function parseQuoteWithHistory(
  userMessage: string,
  history: ChatMessage[] = []
): Promise<AiQuoteDraft> {
  try {
    const response = await fetch('/api/ai-parse-quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: userMessage, history }),
    });

    if (!response.ok) {
      throw new Error('API调用失败');
    }

    const data = await response.json();
    return data as AiQuoteDraft;
  } catch (error) {
    console.error('AI解析失败:', error);

    return {
      devices: [],
      missingFields: ['服务暂不可用'],
      suggestions: ['AI服务暂时不可用，请检查网络连接后重试'],
      error: '网络错误，请重试'
    };
  }
}

// 格式化价格
export function formatPrice(price: number): string {
  if (price >= 10000) {
    return `${(price / 10000).toFixed(1)}万`;
  }
  return price.toLocaleString('zh-CN');
}

// 解析服务模式
export function parseServiceMode(mode?: string): string {
  const modeMap: Record<string, string> = {
    '远程': 'remote',
    '驻场': 'onsite',
    '混合': 'hybrid',
  };
  return modeMap[mode || ''] || 'remote';
}

// 解析服务时间
export function parseServiceTime(time?: string): string {
  const timeMap: Record<string, string> = {
    '5x8': '5x8',
    '7x8': '7x8',
    '7x24': '7x24',
  };
  return timeMap[time || ''] || '5x8';
}

// 解析到场时间
export function parseArrivalTime(time?: string): string {
  const timeMap: Record<string, string> = {
    '2小时内': '2h',
    '8小时内': '8h',
  };
  return timeMap[time || ''] || '8h';
}

// 解析响应时间
export function parseResponseTime(time?: string): string {
  const timeMap: Record<string, string> = {
    '10分钟内': '10min',
    '30分钟内': '30min',
    '1小时内': '1h',
  };
  return timeMap[time || ''] || '30min';
}
