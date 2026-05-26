// 13项增值服务定义
export interface ValueAddedService {
  id: string;
  name: string;
  description: string;
  price: number; // 元/年
  selected: boolean;
}

// 13项增值服务数据
export const VALUE_ADDED_SERVICES: ValueAddedService[] = [
  {
    id: 'regular-inspection',
    name: '定期巡检服务',
    description: '日常巡检、预防性维护',
    price: 5000,
    selected: false
  },
  {
    id: 'maintenance-report',
    name: '定期维保报告服务',
    description: '每月/季度/年度提供巡检报告、故障统计、设备健康度分析',
    price: 3000,
    selected: false
  },
  {
    id: 'system-upgrade',
    name: '系统升级/固件更新服务',
    description: '定期升级设备固件、系统补丁、安全更新',
    price: 4000,
    selected: false
  },
  {
    id: 'emergency-drill',
    name: '应急演练服务',
    description: '如UPS断电演练、机房空调故障演练、网络断网演练',
    price: 6000,
    selected: false
  },
  {
    id: 'data-backup',
    name: '数据备份与恢复协助',
    description: '协助定期备份、故障时恢复数据',
    price: 3500,
    selected: false
  },
  {
    id: 'dedicated-contact',
    name: '专人对接服务',
    description: '指定唯一项目经理/技术负责人，全程对接',
    price: 2000,
    selected: false
  },
  {
    id: 'training',
    name: '培训服务',
    description: '对甲方人员操作、简单故障排查、使用培训',
    price: 2500,
    selected: false
  },
  {
    id: 'security-compliance',
    name: '涉密/安全合规要求',
    description: '维保人员需无犯罪记录、保密协议、涉密培训',
    price: 3000,
    selected: false
  },
  {
    id: 'access-management',
    name: '进出管理特殊要求',
    description: '进入机房/保密区域需审批、陪同、登记',
    price: 1500,
    selected: false
  },
  {
    id: 'zero-downtime',
    name: '零停机维护要求',
    description: '维护必须在夜间/周末进行，不影响白天业务',
    price: 4500,
    selected: false
  },
  {
    id: 'asset-management',
    name: '设备台账管理',
    description: '协助建立、更新、完善设备资产台账',
    price: 2000,
    selected: false
  },
  {
    id: 'third-party-coordination',
    name: '第三方协调服务',
    description: '协助协调运营商、设备厂家、其他施工单位',
    price: 3000,
    selected: false
  },
  {
    id: 'on-site-spare-parts',
    name: '备件现场备用',
    description: '常用配件（硬盘、电源、摄像头、交换机等）放在甲方现场备用，坏了直接换',
    price: 8000,
    selected: false
  }
];

// 计算选中的增值服务总价
export function calculateValueAddedServicesTotal(services: ValueAddedService[]): number {
  return services
    .filter(service => service.selected)
    .reduce((sum, service) => sum + service.price, 0);
}
