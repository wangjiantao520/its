export type UserRole = 'its_member' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

// 模拟当前用户（实际应用中应该从后端或认证系统获取）
export const getCurrentUser = (): User => {
  // 这里先模拟一个用户，实际应用中应该从认证系统获取
  return {
    id: '1',
    name: '当前用户',
    role: 'its_member', // 默认是ITS成员
  };
};

// 切换角色（仅用于演示）
export const switchUserRole = (role: UserRole): User => {
  return {
    id: '1',
    name: role === 'its_member' ? 'ITS成员' : '管理员',
    role,
  };
};

// 设备清单导入状态
export type ImportStatus = 'pending' | 'approved' | 'rejected';

export interface DeviceImportItem {
  id: string;
  deviceName: string;
  quantity: number;
  contractYears: number;
  needSparePart: boolean;
  depreciationLevel: string;
  inWarranty: boolean;
  submittedBy: string;
  submittedAt: Date;
  status: ImportStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComment?: string;
}

// 模拟设备导入数据存储
let deviceImports: DeviceImportItem[] = [];

export const getDeviceImports = (): DeviceImportItem[] => {
  return deviceImports;
};

export const addDeviceImport = (item: Omit<DeviceImportItem, 'id' | 'submittedAt' | 'status'>): DeviceImportItem => {
  const newItem: DeviceImportItem = {
    ...item,
    id: Date.now().toString(),
    submittedAt: new Date(),
    status: 'pending',
  };
  deviceImports.push(newItem);
  return newItem;
};

export const updateDeviceImportStatus = (
  id: string,
  status: ImportStatus,
  reviewedBy: string,
  reviewComment?: string
): DeviceImportItem | null => {
  const index = deviceImports.findIndex(item => item.id === id);
  if (index !== -1) {
    deviceImports[index] = {
      ...deviceImports[index],
      status,
      reviewedBy,
      reviewedAt: new Date(),
      reviewComment,
    };
    return deviceImports[index];
  }
  return null;
};
