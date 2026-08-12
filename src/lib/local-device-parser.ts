/**
 * 本地规则设备识别解析器。
 *
 * 用设备库（dbDeviceQuotas）做词典，从文本/文件中纯本地识别设备，
 * 不依赖 DeepSeek（Coze 环境访问外部 AI 慢会超时）。
 * 输出结构与 ai-quote-parser 的 AiQuoteDraft/AiDevice 一致，消费端零改动。
 */

export interface LocalQuotaDevice {
  id: string;
  name: string;
  category?: string;
  model?: string;
  brand?: string;
  cityPrice?: number;
  maintenanceRate?: number;
  year1TotalPrice?: number;
  year2TotalPrice?: number;
  year3TotalPrice?: number;
}

export interface LocalParsedDevice {
  rawText: string;
  deviceName: string;
  model?: string;
  brand?: string;
  quantity: number;
  useYears?: number;
  confidence: number;
  matchedDeviceId?: string;
  matchedDeviceName?: string;
  matchedPrice?: number;
  matchedMaintenanceRate?: number;
  matchedYear1Price?: number;
  matchedYear2Price?: number;
  matchedYear3Price?: number;
  warnings?: string[];
}

export interface LocalParseResult {
  devices: LocalParsedDevice[];
  unmatchedText: string[];
  suggestions: string[];
}

// 复刻 ai-match-devices 的相似度打分
function calculateMatchScore(deviceName: string, targetName: string): number {
  const name = deviceName.toLowerCase();
  const target = targetName.toLowerCase();

  if (name === target) return 1.0;

  if (name.includes(target) || target.includes(name)) {
    const shorter = Math.min(name.length, target.length);
    const longer = Math.max(name.length, target.length);
    return shorter / longer * 0.9;
  }

  const words1 = name.split(/[\s\-_]+/).filter(w => w.length > 1);
  const words2 = target.split(/[\s\-_]+/).filter(w => w.length > 1);

  const common = words1.filter(w => words2.includes(w));
  const union = [...new Set([...words1, ...words2])];

  if (common.length === 0) return 0;

  return common.length / union.length * 0.8;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[\s\-_/\\()（）·.]+/g, '');
}

// 从文本段提取数量（如 "3台" "2 个" "1套"）
function extractQuantity(segment: string): number {
  const match = /(\d+(?:\.\d+)?)\s*(台|个|套|只|部|批)/.exec(segment);
  if (!match) return 1;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 1;
}

// 从文本段提取使用年限（如 "3年" "使用2年"）
function extractUseYears(segment: string): number | undefined {
  const match = /(?:使用|用了|已用)?\s*(\d+)\s*年/.exec(segment);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function extractBrandModel(segment: string): { brand?: string; model?: string } {
  const brand = /(华为|华三|h3c|cisco|思科|海康|大华|浪潮|联想|戴尔|dell|hp|惠普|锐捷|中兴|深信服|山石)/i.exec(segment)?.[1];
  const model = /([A-Z][A-Z0-9-]{2,}(?:-[A-Z0-9]+)*)/.exec(segment)?.[1];
  return { brand, model };
}

/**
 * 从已加载的设备库构建词典，返回「归一化名称 → 设备」映射。
 * 优先 device_quotas（含价格）；同名前保留第一条。
 */
export function buildDeviceDictionary(quotas: LocalQuotaDevice[]): Map<string, LocalQuotaDevice> {
  const dictionary = new Map<string, LocalQuotaDevice>();
  for (const quota of quotas) {
    if (!quota?.name) continue;
    const key = normalizeName(quota.name);
    if (!key || dictionary.has(key)) continue;
    dictionary.set(key, quota);
  }
  return dictionary;
}

/**
 * 本地识别一段文本里的设备。
 * 对每行/每个标点分隔的片段，扫描设备库词典做名称子串匹配 + 相似度打分。
 */
export function parseDevicesLocal(
  text: string,
  quotas: LocalQuotaDevice[],
): LocalParseResult {
  const dictionary = buildDeviceDictionary(quotas);
  const normalizedEntries = Array.from(dictionary.entries());
  const found: LocalParsedDevice[] = [];
  const unmatchedText: string[] = [];

  // 按行 + 逗号/分号/句号切分片段
  const segments = text
    .split(/\r?\n|，|,|；|;|。|、/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // 纯"使用N年"片段：并入前一个已识别设备的年限信息
    const isYearOnly = /^(?:使用|已用|用了)?\s*\d+\s*年$/.test(segment);
    if (isYearOnly && found.length > 0) {
      const years = extractUseYears(segment);
      if (years !== undefined) {
        const lastDevice = found[found.length - 1];
        if (lastDevice && lastDevice.useYears === undefined) {
          lastDevice.useYears = years;
        }
      }
      continue;
    }
    // 先在词典里找子串命中的设备（最长匹配优先）
    const segmentNorm = normalizeName(segment);
    let best: { device: LocalQuotaDevice; score: number; matchedName: string } | null = null;

    for (const [key, device] of normalizedEntries) {
      // 1. 片段包含设备名（或设备名包含片段关键词）
      if (segmentNorm.includes(key) || key.includes(segmentNorm.slice(0, Math.max(4, key.length)))) {
        const score = calculateMatchScore(device.name, segment);
        if (!best || score > best.score) {
          best = { device, score, matchedName: device.name };
        }
      }
    }

    // 2. 无子串命中时，对整段做全词典相似度打分
    if (!best) {
      let topScore = 0;
      let topDevice: LocalQuotaDevice | null = null;
      for (const [, device] of normalizedEntries) {
        const score = calculateMatchScore(device.name, segment);
        if (score > topScore) {
          topScore = score;
          topDevice = device;
        }
      }
      // 片段与设备名有共同核心子串（如"交换机"）时，视为候选命中
      // 中文无空格分隔，用 2+ 字连续子串扫描设备名
      if (!topDevice || topScore < 0.5) {
        const segmentNorm = segment.toLowerCase();
        let bestShared: { device: LocalQuotaDevice; shared: number } | null = null;
        for (const [, device] of normalizedEntries) {
          const nameNorm = device.name.toLowerCase();
          // 收集设备名的 2-4 字连续子串作为特征词
          const featureSet = new Set<string>();
          for (let length = 4; length >= 2; length--) {
            for (let i = 0; i + length <= nameNorm.length; i++) {
              featureSet.add(nameNorm.slice(i, i + length));
            }
          }
          let shared = 0;
          for (const feature of featureSet) {
            if (segmentNorm.includes(feature)) shared++;
          }
          if (shared > 0 && (!bestShared || shared > bestShared.shared)) {
            bestShared = { device, shared };
          }
        }
        if (bestShared && bestShared.shared >= 1) {
          topScore = Math.max(topScore, 0.55);
          topDevice = bestShared.device;
        }
      }
      if (topDevice && topScore >= 0.5) {
        best = { device: topDevice, score: topScore, matchedName: topDevice.name };
      }
    }

    if (best) {
      const { brand, model } = extractBrandModel(segment);
      found.push({
        rawText: segment,
        deviceName: best.matchedName,
        model: model || best.device.model || '',
        brand: brand || best.device.brand || '',
        quantity: extractQuantity(segment),
        useYears: extractUseYears(segment),
        confidence: Math.min(0.99, 0.6 + best.score * 0.4),
        matchedDeviceId: best.device.id,
        matchedDeviceName: best.device.name,
        matchedPrice: best.device.cityPrice,
        matchedMaintenanceRate: best.device.maintenanceRate,
        matchedYear1Price: best.device.year1TotalPrice,
        matchedYear2Price: best.device.year2TotalPrice,
        matchedYear3Price: best.device.year3TotalPrice,
        warnings: best.score < 0.7 ? ['匹配度较低，请人工确认'] : undefined,
      });
    } else {
      unmatchedText.push(segment);
    }
  }

  return {
    devices: found,
    unmatchedText,
    suggestions: found.length === 0
      ? ['未能识别设备，请检查文本是否包含设备名称，或补充后重试']
      : unmatchedText.length > 0
        ? [`${unmatchedText.length} 段内容未识别到设备，可手动补充`]
        : [],
  };
}
