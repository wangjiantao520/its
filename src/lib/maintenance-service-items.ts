/**
 * 按次服务项计价模型。
 *
 * 与「设备 × 定额单价」的设备维保并行，表达「服务类型 × 单次单价 × 年预估次数
 * → 年费用 × 服务年限 → 总额」的按次服务维保报价（如机房 UPS/精密空调维护）。
 * 服务项不计增值税，直接汇总，与设备维保可混合。
 */

/** 一条按次服务项（对应商务报价单的「服务类型/服务内容/数量/单位/单价/年预估次数」行） */
export interface ServiceItem {
  id: string;               // 行 id（如 'svc-1'）
  name: string;             // 服务类型（例行巡检 / 专项测试 / 故障抢修 / 精密空调维护 …）
  description: string;      // 服务内容
  unit: string;             // 单位（项/台/套）
  quantity: number;         // 数量
  unitPrice: number;        // 单价（元）
  timesPerYear: number;     // 年预估次数（默认 1，即单价按年计）
  settledByActual: boolean; // 按实结算（不计入固定总额）
}

export interface ServiceItemResult {
  item: ServiceItem;
  yearCost: number;   // 年费用 = unitPrice × quantity × max(timesPerYear, 1)
  totalCost: number;  // 总额 = 年费用 × contractYears
}

export interface ServiceItemsCalc {
  results: ServiceItemResult[];
  yearTotal: number; // 年费用合计（不含税）
  total: number;     // 总额合计（不含税）
}

export function calculateServiceItems(
  serviceItems: ServiceItem[],
  contractYears: number,
): ServiceItemsCalc {
  const years = Number.isFinite(contractYears) && contractYears > 0 ? contractYears : 1;

  const results = serviceItems.map((item) => {
    const yearCost = item.settledByActual
      ? 0
      : (item.unitPrice || 0) * (item.quantity || 0) * Math.max(item.timesPerYear || 1, 1);
    return { item, yearCost, totalCost: yearCost * years };
  });

  const yearTotal = results.reduce((sum, r) => sum + r.yearCost, 0);
  const total = results.reduce((sum, r) => sum + r.totalCost, 0);

  return { results, yearTotal, total };
}
