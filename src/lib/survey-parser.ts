import * as XLSX from 'xlsx';
import { FULL_DEVICE_QUOTAS } from './complete-device-data';
import type { FullDeviceQuota } from './device-quota-full';

// 维保查勘问询信息记录表类型定义
export interface SurveyFormData {
  basicInfo: {
    previousService: boolean;
    companyName: string;
    contactPerson: string;
    contactPosition: string;
    contactPhone: string;
    responseTime: string;
    monthlyFaultCount: string;
    lastServiceEndDate: string;
    hasUnreturnedTools: boolean;
    remarks: string;
    systemTransition: boolean;
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
    isResident: boolean;
    specialRequirements: string[];
  };
  budget: {
    paymentMode: string;
    singlePrice: boolean;
    qualityGuarantee: boolean;
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
      previousService: false,
      companyName: '',
      contactPerson: '',
      contactPosition: '',
      contactPhone: '',
      responseTime: '',
      monthlyFaultCount: '',
      lastServiceEndDate: '',
      hasUnreturnedTools: false,
      remarks: '',
      systemTransition: false
    },
    scope: {
      computers: new Array(8).fill(false),
      officePeripherals: new Array(5).fill(false),
      printing: new Array(8).fill(false),
      avConference: new Array(10).fill(false),
      network: new Array(6).fill(false),
      security: new Array(12).fill(false),
      roomPower: new Array(5).fill(false),
      officeEnvironment: new Array(4).fill(false),
      servers: new Array(6).fill(false),
      selfService: new Array(6).fill(false)
    },
    requirements: {
      serviceType: [],
      responseRequirements: [],
      isResident: false,
      specialRequirements: []
    },
    budget: {
      paymentMode: '',
      singlePrice: false,
      qualityGuarantee: false
    }
  };
}

// 设备分类映射
const DEVICE_CATEGORY_MAP: Record<string, string> = {
  '计算机及移动办公类': '计算机终端类',
  '办公外设&存储类': '办公外设&存储',
  '文印及图文处理类': '打印复印扫描类',
  '会议及音视频类': '音视频会议系统',
  '网络通信类': '网络基础设备',
  '安防监控及出入管理类': '视频监控系统',
  '机房及动力保障类': '机房环境设备',
  '办公环境及后勤保障类': '办公环境及后勤',
  '服务器及存储类': '服务器&存储',
  '自助及专用业务类': '自助终端&专用设备'
};

// 设备名称到ID的映射
const DEVICE_NAME_MAP: Record<string, string> = {
  '台式品牌电脑': 'device-001',
  '台式组装电脑': 'device-002',
  '笔记本电脑': 'device-003',
  '瘦客户机': 'device-004',
  '一体机（非触控）': 'device-005',
  '一体机（触控）': 'device-006',
  '平板电脑': 'device-007',
  '二合一电脑': 'device-008',
  '单电脑主机': 'device-009'
};

// 解析维保查勘问询信息记录表Excel文件
export function parseSurveyExcel(data: ArrayBuffer): SurveyFormData {
  try {
    const uint8Data = new Uint8Array(data);
    const workbook = XLSX.read(uint8Data, { type: 'array' });
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    const formData = createEmptySurveyForm();
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !row[0]) continue;
      
      const cellValue = String(row[0] || '');
      
      if (cellValue.includes('前期是否维保服务单位')) {
        formData.basicInfo.previousService = String(row[1] || '').includes('是');
      } else if (cellValue.includes('单位名称')) {
        formData.basicInfo.companyName = String(row[1] || '');
      } else if (cellValue.includes('对接人姓名')) {
        formData.basicInfo.contactPerson = String(row[1] || '');
      } else if (cellValue.includes('对接人岗位')) {
        formData.basicInfo.contactPosition = String(row[1] || '');
      } else if (cellValue.includes('联系电话')) {
        formData.basicInfo.contactPhone = String(row[1] || '');
      }
    }
    
    return formData;
  } catch (error) {
    console.error('解析Excel失败:', error);
    return createEmptySurveyForm();
  }
}

// 根据记录表生成报价
export function generateQuoteFromSurvey(
  surveyData: SurveyFormData, 
  region: '城区' | '市区县城郊区' | '乡镇' | '农村' = '城区',
  serviceTime: '5×8' | '7×8' | '7×24' = '5×8',
  securityLevel: '1级' | '2级' | '3级' | '4级' | '5级' = '3级'
): QuoteResult {
  const selectedDevices: FullDeviceQuota[] = [];
  const deviceNames: string[] = [];
  
  const sampleDevices = FULL_DEVICE_QUOTAS.slice(0, 5);
  sampleDevices.forEach(device => {
    selectedDevices.push(device);
    deviceNames.push(device.name);
  });
  
  let totalInspectionFee = 0;
  let totalOnSiteFee = 0;
  let totalFaultHandlingFee = 0;
  let totalToolFee = 0;
  let totalConsumableFee = 0;
  let totalSparePartFee = 0;
  let totalPrice = 0;
  
  selectedDevices.forEach(device => {
    const price = getDevicePriceByRegion(device, region);
    totalPrice += price;
    totalInspectionFee += device.inspectionFeeAnnual || 0;
    totalOnSiteFee += device.onSiteFeeAnnual || 0;
    totalFaultHandlingFee += device.faultHandlingFeeTotal || 0;
    totalToolFee += device.toolAmortization || 0;
    totalConsumableFee += device.consumableFee || 0;
    totalSparePartFee += device.sparePartReserve || 0;
  });
  
  return {
    totalPrice,
    deviceCount: selectedDevices.length,
    selectedDevices,
    serviceTime,
    securityLevel,
    region,
    details: {
      deviceNames,
      totalInspectionFee,
      totalOnSiteFee,
      totalFaultHandlingFee,
      totalToolFee,
      totalConsumableFee,
      totalSparePartFee
    }
  };
}

// 获取设备在指定地区的价格
function getDevicePriceByRegion(device: FullDeviceQuota, region: '城区' | '市区县城郊区' | '乡镇' | '农村'): number {
  switch (region) {
    case '城区':
      return device.cityPrice;
    case '市区县城郊区':
      return device.urbanPrice;
    case '乡镇':
      return device.townPrice;
    case '农村':
      return device.ruralPrice;
    default:
      return device.cityPrice;
  }
}
