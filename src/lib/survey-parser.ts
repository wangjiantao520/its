import * as XLSX from 'xlsx';
import type { FullDeviceQuota } from './device-quota-full';

// 维保查勘问询信息记录表类型定义
export interface SurveyFormData {
  basicInfo: {
    previousService: boolean | null;
    companyName: string;
    contactPerson: string;
    contactPosition: string;
    contactPhone: string;
    responseTime: string;
    monthlyFaultCount: string;
    lastServiceEndDate: string;
    hasUnreturnedTools: boolean | null;
    remarks: string;
    systemTransition: boolean | null;
  };
  scope: {
    computers: boolean[];
    officePeripherals: boolean[];
    printing: boolean[];
    avConference: boolean[];
    network: boolean[];
    security: boolean[];
    roomPower: boolean[];
    officeEnvironment: boolean[];
    servers: boolean[];
    selfService: boolean[];
  };
  requirements: {
    serviceType: string[];
    responseRequirements: string[];
    isResident: boolean | null;
    specialRequirements: string[];
  };
  budget: {
    paymentMode: string;
    singlePrice: boolean | null;
    qualityGuarantee: boolean | null;
  };
}

// 报价结果类型定义
export interface QuoteResult {
  totalPrice: number;
  deviceCount: number;
  selectedDevices: FullDeviceQuota[];
  serviceTime: string;
  securityLevel: string;
  region: string;
  contractYears: number;
  year1Total: number;
  year2Total: number;
  year3Total: number;
  details: {
    deviceNames: string[];
    totalInspectionFee: number;
    totalOnSiteFee: number;
    totalFaultHandlingFee: number;
    totalToolFee: number;
    totalConsumableFee: number;
    totalSparePartFee: number;
  };
}

// 初始化空表单数据
export function createEmptySurveyForm(): SurveyFormData {
  return {
    basicInfo: {
      previousService: null,
      companyName: '',
      contactPerson: '',
      contactPosition: '',
      contactPhone: '',
      responseTime: '',
      monthlyFaultCount: '',
      lastServiceEndDate: '',
      hasUnreturnedTools: null,
      remarks: '',
      systemTransition: null
    },
    scope: {
      computers: [],
      officePeripherals: [],
      printing: [],
      avConference: [],
      network: [],
      security: [],
      roomPower: [],
      officeEnvironment: [],
      servers: [],
      selfService: []
    },
    requirements: {
      serviceType: [],
      responseRequirements: [],
      isResident: null,
      specialRequirements: []
    },
    budget: {
      paymentMode: '',
      singlePrice: null,
      qualityGuarantee: null
    }
  };
}

function parseYesNo(value: string): boolean | null {
  const answer = value.replace(/\s+/g, '');
  if (!answer) return null;
  if (['否', '没有', '无', '不需要', '无需'].some((word) => answer.startsWith(word))) return false;
  if (['是', '有', '需要'].some((word) => answer.startsWith(word))) return true;
  return null;
}

// 解析维保查勘问询信息记录表Excel文件
export function parseSurveyExcel(data: ArrayBuffer): SurveyFormData {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('工作簿中没有工作表');
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) throw new Error('工作簿首个工作表无法读取');
  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
  const formData = createEmptySurveyForm();
  let recognizedFieldCount = 0;
  let populatedFieldCount = 0;

  for (const row of jsonData) {
    const cellValue = String(row[0] ?? '').trim();
    const answer = String(row[1] ?? '').trim();
    if (!cellValue) continue;

    if (cellValue.includes('前期是否维保服务单位')) {
      recognizedFieldCount += 1;
      if (answer) populatedFieldCount += 1;
      formData.basicInfo.previousService = parseYesNo(answer);
    } else if (cellValue.includes('单位名称')) {
      recognizedFieldCount += 1;
      if (answer) populatedFieldCount += 1;
      formData.basicInfo.companyName = answer;
    } else if (cellValue.includes('对接人姓名')) {
      recognizedFieldCount += 1;
      if (answer) populatedFieldCount += 1;
      formData.basicInfo.contactPerson = answer;
    } else if (cellValue.includes('对接人岗位')) {
      recognizedFieldCount += 1;
      if (answer) populatedFieldCount += 1;
      formData.basicInfo.contactPosition = answer;
    } else if (cellValue.includes('联系电话')) {
      recognizedFieldCount += 1;
      if (answer) populatedFieldCount += 1;
      formData.basicInfo.contactPhone = answer;
    }
  }

  if (recognizedFieldCount === 0) {
    throw new Error('未识别到查勘记录字段，请确认文件来自系统支持的查勘模板');
  }
  if (populatedFieldCount === 0) {
    throw new Error('识别到模板字段，但没有填写可保存的内容');
  }
  return formData;
}
