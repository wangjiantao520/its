import * as XLSX from 'xlsx';
import { FULL_DEVICE_QUOTAS } from './complete-device-data';
import type { FullDeviceQuota } from './device-quota-full';

export interface DeviceImportFormData {
  devices: Array<{
    deviceName: string;
    quantity: number;
    contractYears: number;
    needSparePart: boolean;
    depreciationLevel: string;
    inWarranty: boolean;
  }>;
}

export function parseDeviceImportExcel(arrayBuffer: ArrayBuffer): DeviceImportFormData {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const devices: DeviceImportFormData['devices'] = [];

  // 从第2行开始解析（第1行是表头）
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] as string[];
    if (!row || row.length === 0 || !row[0]) continue;

    // 解析每一行数据
    const deviceName = row[0]?.toString().trim() || '';
    const quantity = parseInt(row[1]?.toString() || '1');
    const contractYears = parseInt(row[2]?.toString() || '1');
    const needSparePart = row[3]?.toString().trim() === '是';
    const depreciationLevel = row[4]?.toString().trim() || '正常';
    const inWarranty = row[5]?.toString().trim() === '是';

    if (deviceName) {
      devices.push({
        deviceName,
        quantity: isNaN(quantity) ? 1 : quantity,
        contractYears: isNaN(contractYears) || ![1, 2, 3].includes(contractYears) ? 1 : contractYears,
        needSparePart,
        depreciationLevel,
        inWarranty,
      });
    }
  }

  return { devices };
}

export function validateDeviceImportData(data: DeviceImportFormData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.devices.length === 0) {
    errors.push('设备清单不能为空');
  }

  data.devices.forEach((device, index) => {
    const rowNum = index + 2; // Excel行号（从第2行开始）

    if (!device.deviceName) {
      errors.push(`第${rowNum}行：设备名称不能为空`);
    }

    // 检查设备是否在定额库中
    const foundDevice = FULL_DEVICE_QUOTAS.find(q => q.name === device.deviceName);
    if (!foundDevice) {
      errors.push(`第${rowNum}行：设备"${device.deviceName}"不在定额库中`);
    }

    if (device.quantity < 1) {
      errors.push(`第${rowNum}行：数量必须大于0`);
    }

    if (![1, 2, 3].includes(device.contractYears)) {
      errors.push(`第${rowNum}行：合同年限必须是1、2或3年`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ===== 完整字段导入模板解析（成员端设备清单导入） =====

import type { DeviceImportItem, MaintenanceLevel, EngineerLevel, DepreciationLevel } from './device-imports';

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(String(value).replace(/[¥￥,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bool(value: unknown, fallback = false): boolean {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text === '是' || text === 'Y' || text === 'true' || text === '1';
}

function normalizeLevel(value: string): MaintenanceLevel {
  const text = value.toUpperCase();
  if (['A', 'B', 'C', 'D', 'E'].includes(text)) return text as MaintenanceLevel;
  if (text.includes('简易')) return 'A';
  if (text.includes('基础')) return 'B';
  if (text.includes('中级')) return 'C';
  if (text.includes('高级')) return 'D';
  if (text.includes('专家')) return 'E';
  return 'B';
}

function normalizeEngineer(value: string): EngineerLevel {
  if (value.includes('高级')) return '高级';
  if (value.includes('中级')) return '中级';
  return '初级';
}

function normalizeDepreciation(value: string): DepreciationLevel | undefined {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  if (text.includes('全新')) return '全新';
  if (text.includes('较新')) return '较新';
  if (text.includes('一般')) return '一般';
  if (text.includes('偏旧')) return '偏旧';
  if (text.includes('老旧')) return '老旧';
  return undefined;
}

export interface DeviceImportParseResult {
  devices: Partial<DeviceImportItem>[];
  errors: string[];
}

// 列下标常量（与 /api/device-import-template 列顺序一致）
const COL = {
  category: 0, name: 1, model: 2, level: 3, engineerLevel: 4, deviceCount: 5,
  needSparePart: 6, teamExperienceWithFactor: 7, teamExperienceSimilarFactor: 8,
  teamExperienceWithoutFactor: 9, securityLevel3Factor: 10, supportModeOnsiteFactor: 11,
  faultRecoveryTime24hFactor: 12, inspectionLaborFee: 13, inspectionPersonCount: 14,
  inspectionDuration: 15, inspectionTimesPerYear: 16, inspectionContent: 17,
  onSiteFeeAnnual: 18, trafficFee: 19, faultHandlingFeeTotal: 20, inWarranty: 21,
  depreciationLevelDescription: 22, toolAmortization: 23, consumableFee: 24,
  toolDetails: 25, consumableDetails: 26, sparePartReserve: 27, sparePartBasis: 28,
  cityPrice: 29, faultHandlingFeeDetail: 30, urbanPrice: 31, townPrice: 32,
  ruralPrice: 33, contractYears: 34, coreMaintenanceContent: 35,
} as const;

export function parseDeviceImportRows(rows: readonly (readonly unknown[])[]): DeviceImportParseResult {
  const devices: Partial<DeviceImportItem>[] = [];
  const errors: string[] = [];

  if (rows.length < 2) {
    errors.push('模板为空或没有数据行');
    return { devices, errors };
  }

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const name = String(row[COL.name] ?? '').trim();
    const category = String(row[COL.category] ?? '').trim();
    if (!name && !category && row.every((v) => String(v ?? '').trim() === '')) continue;

    if (!name) {
      errors.push(`第 ${index + 1} 行缺少设备名称`);
      continue;
    }
    if (!category) {
      errors.push(`第 ${index + 1} 行（${name}）缺少设备分类`);
      continue;
    }

    const deviceCount = num(row[COL.deviceCount]) ?? 1;
    const contractYears = num(row[COL.contractYears]) ?? 1;

    devices.push({
      category,
      name,
      model: String(row[COL.model] ?? '').trim(),
      level: normalizeLevel(String(row[COL.level] ?? '')),
      engineerLevel: normalizeEngineer(String(row[COL.engineerLevel] ?? '')),
      deviceCount: Math.max(1, deviceCount),
      needSparePart: bool(row[COL.needSparePart]),
      contractYears: Math.min(3, Math.max(1, contractYears)),
      teamExperienceWithFactor: num(row[COL.teamExperienceWithFactor]),
      teamExperienceSimilarFactor: num(row[COL.teamExperienceSimilarFactor]),
      teamExperienceWithoutFactor: num(row[COL.teamExperienceWithoutFactor]),
      securityLevel3Factor: num(row[COL.securityLevel3Factor]),
      supportModeOnsiteFactor: num(row[COL.supportModeOnsiteFactor]),
      faultRecoveryTime24hFactor: num(row[COL.faultRecoveryTime24hFactor]),
      inspectionLaborFee: num(row[COL.inspectionLaborFee]),
      inspectionPersonCount: num(row[COL.inspectionPersonCount]),
      inspectionDuration: num(row[COL.inspectionDuration]),
      inspectionTimesPerYear: num(row[COL.inspectionTimesPerYear]),
      inspectionContent: String(row[COL.inspectionContent] ?? '').trim(),
      onSiteFeeAnnual: num(row[COL.onSiteFeeAnnual]),
      trafficFee: num(row[COL.trafficFee]),
      faultHandlingFeeTotal: num(row[COL.faultHandlingFeeTotal]),
      inWarrantyFactor: bool(row[COL.inWarranty]) ? 0.5 : 1,
      depreciationLevelDescription: normalizeDepreciation(String(row[COL.depreciationLevelDescription] ?? '')),
      toolAmortization: num(row[COL.toolAmortization]),
      consumableFee: num(row[COL.consumableFee]),
      toolDetails: String(row[COL.toolDetails] ?? '').trim(),
      consumableDetails: String(row[COL.consumableDetails] ?? '').trim(),
      sparePartReserve: num(row[COL.sparePartReserve]),
      sparePartBasis: String(row[COL.sparePartBasis] ?? '').trim(),
      cityPrice: num(row[COL.cityPrice]),
      faultHandlingFeeDetail: num(row[COL.faultHandlingFeeDetail]),
      urbanPrice: num(row[COL.urbanPrice]),
      townPrice: num(row[COL.townPrice]),
      ruralPrice: num(row[COL.ruralPrice]),
      coreMaintenanceContent: String(row[COL.coreMaintenanceContent] ?? '').trim(),
    });
  }

  return { devices, errors };
}
