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
