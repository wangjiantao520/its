/**
 * 需求表自动分流器。
 *
 * 输入一份需求表的行数组 + 维保设备库，输出：
 * - engineeringItems：未命中维保设备库、但带单价的工程材料明细
 * - maintenanceDevices：命中维保设备库的维保设备（带 matchedDeviceId）
 *
 * 两个模块各自消费对应半段，实现「一份需求表同时出工程报价 + 维保报价」。
 */

import { parseDevicesLocal, type LocalQuotaDevice } from './local-device-parser';

/** 明确属于工程材料/施工的词：即使设备库有近似名，也优先归工程（如"防静电地板"是装修材料，不是要维保的设备） */
const ENGINEERING_MATERIAL_KEYWORDS = [
  '地板', '线缆', '线槽', '桥架', '套管', '插座', '跳线', '配线架',
  '配线', '施工费', '光纤盒', '网线', '电缆', '光纤',
];

/** 需求表的一行（来自 Excel，单元格已按列展开） */
export interface RequirementRow {
  name: string;
  specification: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  location: string;
  raw?: string;
}

/** 工程报价明细项（对应 QuoteItem custom 行） */
export interface SplitEngineeringItem {
  customName: string;
  customUnit: string;
  customPrice: number;
  quantity: number;
  location: string;
}

/** 维保设备（对应 AiDevice，带 matchedDeviceId） */
export interface SplitMaintenanceDevice {
  rawText: string;
  deviceName: string;
  model?: string;
  quantity: number;
  useYears?: number;
  matchedDeviceId?: string;
  matchedDeviceName?: string;
  matchedPrice?: number;
  confidence: number;
  warnings?: string[];
}

export interface SplitResult {
  engineeringItems: SplitEngineeringItem[];
  maintenanceDevices: SplitMaintenanceDevice[];
}

// 从字符串单元格解析数值（去货币符号、千分位）
function parseNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[¥￥,\s]/g, '').trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * 从 Excel 行数组拆分需求表。
 *
 * 每行可能是数组（header:1 的 sheet_to_json 输出）或对象。
 * 兼容两种结构：数组按列位置取，对象按常见列名取。
 */
export function splitRequirementRows(
  rows: Array<unknown[] | Record<string, unknown>>,
  quotas: LocalQuotaDevice[],
): SplitResult {
  const engineeringItems: SplitEngineeringItem[] = [];
  const maintenanceDevices: SplitMaintenanceDevice[] = [];

  for (const row of rows) {
    let name = '';
    let specification = '';
    let unit = '项';
    let quantity = 1;
    let unitPrice: number | undefined;
    let location = '';

    if (Array.isArray(row)) {
      // 常见工程报价表列：0=名称 1=规格 2=位置 3=单位 4=数量 5=单价 9=总价
      name = String(row[0] ?? '').trim();
      specification = String(row[1] ?? '').trim();
      location = String(row[2] ?? '').trim();
      unit = String(row[3] ?? '').trim() || '项';
      quantity = parseNumberValue(row[4]) ?? 1;
      unitPrice = parseNumberValue(row[5]);
      if (unitPrice === undefined && quantity > 0) {
        const total = parseNumberValue(row[9]);
        if (total !== undefined) unitPrice = total / quantity;
      }
    } else {
      const pick = (keys: string[]): string => {
        for (const key of keys) {
          const value = row[key];
          if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
        }
        return '';
      };
      name = pick(['名称', '项目名称', 'name', 'Name', '设备名称', '设备']);
      specification = pick(['规格', '型号', '规格型号', 'spec', 'model', 'specification']);
      location = pick(['归属位置', '楼层', '位置', 'location']);
      unit = pick(['单位', 'unit']) || '项';
      quantity = parseNumberValue(pick(['数量', 'quantity', 'qty'])) ?? 1;
      unitPrice = parseNumberValue(pick(['单价', 'price', 'unitPrice', 'unit_price']));
    }

    if (!name || name === '合计' || name === '总计') continue;

    // 工程材料关键词：如"防静电地板/配线架/跳线/线缆"这类明确是装修材料或施工项，
    // 即使设备库有近似名（如"静电地板"）也优先归工程，不当作维保设备
    const isEngineeringMaterial = ENGINEERING_MATERIAL_KEYWORDS.some((keyword) => name.includes(keyword));

    // 用本地解析器判断是否为维保设备（命中设备库词典）
    const local = parseDevicesLocal(`${name} ${specification}`, quotas);
    const matched = !isEngineeringMaterial ? local.devices.find((d) => d.matchedDeviceId) : undefined;

    if (matched) {
      maintenanceDevices.push({
        rawText: `${name} ${specification} ${quantity}台`,
        deviceName: matched.deviceName,
        model: matched.model,
        quantity,
        useYears: matched.useYears,
        matchedDeviceId: matched.matchedDeviceId,
        matchedDeviceName: matched.matchedDeviceName,
        matchedPrice: matched.matchedPrice,
        confidence: matched.confidence,
        warnings: matched.warnings,
      });
    } else if (unitPrice !== undefined) {
      // 未命中设备库但带单价 → 工程材料明细
      engineeringItems.push({
        customName: name,
        customUnit: unit,
        customPrice: unitPrice,
        quantity,
        location,
      });
    }
  }

  return { engineeringItems, maintenanceDevices };
}
