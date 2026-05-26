
/**
 * 维保设备台账信息表
 */

export interface EquipmentLedger {
  id: string;
  serialNumber: number;
  equipmentName: string;
  specificationModel: string;
  brand: string;
  factorySerialNumber: string;
  installationLocation: string;
  usingDepartment: string;
  installationDate: string;
  purchasePrice: number;
  isOutOfWarranty: boolean;
  maintenanceStatus: string;
  remarks?: string;
}

export const EQUIPMENT_LEDGER_COLUMNS = [
  { key: 'serialNumber', label: '序号', type: 'number' },
  { key: 'equipmentName', label: '设备名称', type: 'string' },
  { key: 'specificationModel', label: '规格型号', type: 'string' },
  { key: 'brand', label: '品牌', type: 'string' },
  { key: 'factorySerialNumber', label: '出厂序列号/设备编号', type: 'string' },
  { key: 'installationLocation', label: '安装位置', type: 'string' },
  { key: 'usingDepartment', label: '使用部门', type: 'string' },
  { key: 'installationDate', label: '安装/启用日期', type: 'date' },
  { key: 'purchasePrice', label: '采购价', type: 'number' },
  { key: 'isOutOfWarranty', label: '是否过保', type: 'boolean' },
  { key: 'maintenanceStatus', label: '维保状态', type: 'string' },
  { key: 'remarks', label: '备注', type: 'string' }
];

export const SAMPLE_EQUIPMENT_LEDGER: EquipmentLedger[] = [
  {
    id: 'ledger-1',
    serialNumber: 1,
    equipmentName: '台式计算机',
    specificationModel: 'ThinkCentre M90t',
    brand: '联想',
    factorySerialNumber: 'PC-2024-001',
    installationLocation: '办公楼301室',
    usingDepartment: '信息科',
    installationDate: '2022-01-15',
    purchasePrice: 5800,
    isOutOfWarranty: true,
    maintenanceStatus: '正常维保中',
    remarks: '日常办公使用'
  },
  {
    id: 'ledger-2',
    serialNumber: 2,
    equipmentName: '激光打印机',
    specificationModel: 'HP LaserJet Pro MFP M429fdw',
    brand: '惠普',
    factorySerialNumber: 'PR-2024-002',
    installationLocation: '办公楼302室',
    usingDepartment: '办公室',
    installationDate: '2023-03-20',
    purchasePrice: 3200,
    isOutOfWarranty: false,
    maintenanceStatus: '正常维保中',
    remarks: '共享打印设备'
  },
  {
    id: 'ledger-3',
    serialNumber: 3,
    equipmentName: '网络交换机',
    specificationModel: 'Cisco Catalyst 2960-X',
    brand: '思科',
    factorySerialNumber: 'SW-2024-003',
    installationLocation: '机房101柜',
    usingDepartment: '信息科',
    installationDate: '2021-08-10',
    purchasePrice: 8500,
    isOutOfWarranty: true,
    maintenanceStatus: '待维保',
    remarks: '核心网络设备'
  }
];
