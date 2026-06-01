// AI辅助报价 - 调用真实DeepSeek API版本
// 类型定义

export type RecognitionStatus = 'idle' | 'analyzing' | 'success' | 'needs_info' | 'failed';

export interface CandidateDevice {
  id: string;
  name: string;
  category: string;
}

export interface AiQuoteDraft {
  customerName?: string;
  projectName?: string;
  region?: "城区" | "市区县城郊区" | "乡镇" | "农村";
  contractYears?: number;
  annualInspectionCount?: number;
  responseTime?: string;
  arrivalTime?: string;
  serviceTime?: string;
  notes?: string;
  devices: Array<{
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
  }>;
  missingFields: string[];
  suggestions: string[];
  quotaList?: Array<{
    id: string;
    name: string;
    category: string;
    model?: string;
  }>;
}

// 示例需求
export const AI_QUOTE_EXAMPLES = [
  "城区某单位有1台全新手动装订机，需要一年维保，每季度巡检一次。",
  "某乡镇单位有20台使用3年的台式电脑、2台使用5年的电动装订机，需要一年维保，每季度巡检一次，故障后8小时内到场。",
  "有一批办公设备需要维保。"
];

// 调用真实DeepSeek API的解析器
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
    
    // 失败时返回一个默认结果
    return {
      devices: [],
      missingFields: ['设备清单'],
      suggestions: ['AI服务暂时不可用，请稍后重试'],
    };
  }
}
