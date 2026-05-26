
import type { FullDeviceQuota } from './device-quota-full';

// 完整的设备定额数据（基于Excel的126条数据，这里展示完整数据结构和代表性设备）
export const FULL_DEVICE_QUOTAS: FullDeviceQuota[] = [
  // ===== 计算机终端类 =====
  {
    id: 'device-001',
    serialNumber: 1,
    category: '计算机终端类',
    name: '台式品牌电脑',
    model: '商用办公',
    unit: '台',
    level: 'B',
    levelName: '基础型',
    engineerLevel: '初级',
    levelDescription: '标准办公通用设备、维护难度适中',
    inspectionLaborFee: 33.67,
    inspectionPersonCount: 1,
    inspectionDuration: 10,
    inspectionTimesPerYear: 4,
    inspectionContent: '外观检查无破损变形；通电开机自检正常；检查CPU、内存、硬盘资源占用率；测试USB、网口、音频口等外设接口功能；检查系统日志与报错信息；查杀病毒木马；清理风扇灰尘；确认系统时间与网络连接正常；检查硬盘健康状态',
    inspectionFeeAnnual: 134.67,
    trafficFee: 20,
    singleTripDuration: 15,
    connectionDuration: 2,
    onSiteConnectionLaborFee: 26.93,
    onSiteFeeAnnual: 56.32,
    inWarrantyFactor: 1.0,
    baseFaultCount: 2.0,
    depreciationFactor: 0.6,
    faultServiceCount: 1.2,
    faultHandlerCount: 1,
    faultHandlingDuration: 75,
    faultHandlingLaborFee: 101.00,
    faultHandlingFeeTotal: 139.11,
    toolAmortization: 2.04,
    toolDetails: '螺丝刀套装、防静电手环、数字万用表、系统启动U盘、导热硅脂、清洁套装',
    consumableFee: 5,
    consumableDetails: '清洁布、除尘毛刷、螺丝批头、扎带',
    sparePartReserve: 80,
    sparePartBasis: '设备标准化程度高，备件通用性强，故障多为接口、风扇等低成本部件，风险较低',
    coreMaintenanceContent: '硬件巡检、系统维护、故障排查、驱动更新、基础清洁',
    cityPrice: 172.78,
    urbanPrice: 190.06,
    townPrice: 259.17,
    ruralPrice: 345.56,
    inspectionFeeDetail: 134.67,
    onSiteFeeDetail: 56.32,
    faultHandlingFeeDetail: 139.11,
    toolFeeDetail: 2.04,
    consumableFeeDetail: 5,
    sparePartFeeDetail: 80,
    isActive: true,
    dataSource: '政企设备维保定额库_2026'
  },
  {
    id: 'device-002',
    serialNumber: 2,
    category: '计算机终端类',
    name: '台式组装电脑',
    model: '商用',
    unit: '台',
    level: 'B',
    levelName: '基础型',
    engineerLevel: '初级',
    inspectionLaborFee: 40.40,
    inspectionPersonCount: 1,
    inspectionDuration: 12,
    inspectionTimesPerYear: 4,
    inspectionContent: '检查机箱内部硬件安装牢固；开机自检与硬件信息核对；检测主板、显卡、硬盘运行状态；检查驱动程序完整性；排查系统稳定性与蓝屏日志；测试网络连通性；测试外设接口功能；监测风扇转速与温度；清理内部灰尘',
    inspectionFeeAnnual: 161.60,
    trafficFee: 20,
    singleTripDuration: 15,
    connectionDuration: 2,
    onSiteConnectionLaborFee: 26.93,
    onSiteFeeAnnual: 56.32,
    inWarrantyFactor: 1.0,
    baseFaultCount: 2.0,
    depreciationFactor: 0.6,
    faultServiceCount: 1.2,
    faultHandlerCount: 1,
    faultHandlingDuration: 90,
    faultHandlingLaborFee: 121.20,
    faultHandlingFeeTotal: 154.26,
    toolAmortization: 2.04,
    toolDetails: '螺丝刀套装、防静电手环、数字万用表、系统启动U盘、导热硅脂、清洁套装',
    consumableFee: 5,
    consumableDetails: '清洁布、除尘毛刷、导热硅脂、螺丝批头',
    sparePartReserve: 120,
    sparePartBasis: '组装机硬件兼容性差异大，主板、显卡故障概率高于品牌机，需预留更多备件资金',
    coreMaintenanceContent: '硬件检测、兼容性调试、系统优化、故障处理、清洁保养',
    cityPrice: 194.66,
    urbanPrice: 214.13,
    townPrice: 291.99,
    ruralPrice: 389.32,
    inspectionFeeDetail: 161.60,
    onSiteFeeDetail: 56.32,
    faultHandlingFeeDetail: 154.26,
    toolFeeDetail: 2.04,
    consumableFeeDetail: 5,
    sparePartFeeDetail: 120,
    isActive: true,
    dataSource: '政企设备维保定额库_2026'
  }
];

// 获取设备分类列表
export function getDeviceCategories(): string[] {
  const categories = new Set(FULL_DEVICE_QUOTAS.map(d => d.category));
  return Array.from(categories);
}

// 根据分类获取设备列表
export function getDevicesByCategory(category: string): FullDeviceQuota[] {
  return FULL_DEVICE_QUOTAS.filter(d => d.category === category);
}

// 根据维保分档获取设备列表
export function getDevicesByLevel(level: string): FullDeviceQuota[] {
  return FULL_DEVICE_QUOTAS.filter(d => d.level === level);
}

// 根据ID获取设备
export function getDeviceById(id: string): FullDeviceQuota | undefined {
  return FULL_DEVICE_QUOTAS.find(d => d.id === id);
}

// 搜索设备
export function searchDevices(keyword: string): FullDeviceQuota[] {
  const lowerKeyword = keyword.toLowerCase();
  return FULL_DEVICE_QUOTAS.filter(d => 
    d.name.toLowerCase().includes(lowerKeyword) ||
    d.model.toLowerCase().includes(lowerKeyword) ||
    d.category.toLowerCase().includes(lowerKeyword)
  );
}

