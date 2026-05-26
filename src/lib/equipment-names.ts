
/**
 * 具体设备名称明细
 */

export interface EquipmentCategory {
  id: string;
  categoryName: string;
  equipmentNames: string[];
}

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  {
    id: 'cat-1',
    categoryName: '计算机终端类',
    equipmentNames: [
      '台式计算机',
      '便携式计算机',
      '一体机电脑',
      '瘦客户机',
      '平板电脑'
    ]
  },
  {
    id: 'cat-2',
    categoryName: '办公外设与存储',
    equipmentNames: [
      '激光打印机',
      '喷墨打印机',
      '多功能一体机',
      '复印机',
      '扫描仪',
      '投影仪',
      '移动硬盘',
      'U盘'
    ]
  },
  {
    id: 'cat-3',
    categoryName: '网络设备类',
    equipmentNames: [
      '网络交换机',
      '路由器',
      '防火墙',
      '无线AP',
      '网络控制器',
      '光模块'
    ]
  },
  {
    id: 'cat-4',
    categoryName: '安防监控类',
    equipmentNames: [
      '网络摄像头',
      '硬盘录像机',
      '监控显示器',
      '入侵探测器',
      '门禁控制器',
      '报警主机'
    ]
  },
  {
    id: 'cat-5',
    categoryName: '会议系统类',
    equipmentNames: [
      '会议平板',
      '视频会议终端',
      '会议摄像机',
      '麦克风',
      '音响设备',
      '中控系统'
    ]
  },
  {
    id: 'cat-6',
    categoryName: '服务器与存储类',
    equipmentNames: [
      '机架式服务器',
      '塔式服务器',
      '刀片服务器',
      '存储阵列',
      '磁带库',
      'KVM切换器'
    ]
  }
];

export function getEquipmentNamesByCategory(categoryId: string): string[] {
  const category = EQUIPMENT_CATEGORIES.find(cat => cat.id === categoryId);
  return category ? category.equipmentNames : [];
}

export function getAllEquipmentNames(): string[] {
  return EQUIPMENT_CATEGORIES.flatMap(cat => cat.equipmentNames);
}
