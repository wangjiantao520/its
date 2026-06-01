// AI辅助报价 - 简单版本
// 类型定义

export type RecognitionStatus = 'idle' | 'analyzing' | 'success' | 'needs_info' | 'failed';

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
    warnings?: string[];
  }>;
  missingFields: string[];
  suggestions: string[];
}

// 示例需求
export const AI_QUOTE_EXAMPLES = [
  "城区某单位有1台全新手动装订机，需要一年维保，每季度巡检一次。",
  "某乡镇单位有20台使用3年的台式电脑、2台使用5年的电动装订机，需要一年维保，每季度巡检一次，故障后8小时内到场。",
  "有一批办公设备需要维保。"
];

// 简单的规则解析器
export function parseQuoteRequirement(text: string): AiQuoteDraft {
  const draft: AiQuoteDraft = {
    devices: [],
    missingFields: [],
    suggestions: [],
  };

  // 识别地区
  if (text.includes("城区")) {
    draft.region = "城区";
  } else if (text.includes("乡镇")) {
    draft.region = "乡镇";
  } else if (text.includes("农村")) {
    draft.region = "农村";
  } else if (text.includes("市区") || text.includes("县城") || text.includes("郊区")) {
    draft.region = "市区县城郊区";
  }

  // 识别合同年限
  const yearMatch = text.match(/(\d+)\s*年/);
  if (yearMatch) {
    draft.contractYears = parseInt(yearMatch[1]);
  }

  // 识别巡检次数
  if (text.includes("每季度")) {
    draft.annualInspectionCount = 4;
  } else if (text.includes("每月")) {
    draft.annualInspectionCount = 12;
  } else if (text.includes("每半年")) {
    draft.annualInspectionCount = 2;
  }

  // 识别到场时间
  if (text.includes("8小时")) {
    draft.arrivalTime = "8小时";
  } else if (text.includes("2小时")) {
    draft.arrivalTime = "2小时";
  }

  // 简单的设备识别
  const deviceMatches = text.match(/(\d+)\s*台[^，,。.]*?([^\d，,。.]+?)(机|电脑|设备)/g);
  if (deviceMatches) {
    deviceMatches.forEach((match) => {
      const qtyMatch = match.match(/(\d+)\s*台/);
      const nameMatch = match.match(/台[^，,。.]*?([^\d，,。.]+?)(机|电脑|设备)/);
      const yearsMatch = match.match(/使用\s*(\d+)\s*年/);

      draft.devices.push({
        rawText: match,
        quantity: qtyMatch ? parseInt(qtyMatch[1]) : 1,
        deviceName: nameMatch ? nameMatch[1] + (nameMatch[2] || "") : undefined,
        useYears: yearsMatch ? parseInt(yearsMatch[1]) : undefined,
        confidence: 0.7,
      });
    });
  }

  // 检查缺失字段
  if (!draft.region) {
    draft.missingFields.push("服务地区");
  }
  if (!draft.contractYears) {
    draft.missingFields.push("合同年限");
  }
  if (draft.devices.length === 0) {
    draft.missingFields.push("设备清单");
  }

  // 建议
  if (draft.missingFields.length > 0) {
    draft.suggestions.push("请补充以下信息：" + draft.missingFields.join("、"));
  }

  return draft;
}
