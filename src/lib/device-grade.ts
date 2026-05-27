// 设备分档和成新率数据

// 成新率等级
export type DepreciationGrade = 1 | 2 | 3 | 4 | 5;

// 设备分档
export type DeviceGrade = 'A' | 'B' | 'C' | 'D' | 'E';

// 设备分档数据接口
export interface DeviceGradeData {
  grade: DeviceGrade;
  yearlyFaultBase: number; // 年故障数基准值
  depreciationFactors: {
    [key in DepreciationGrade]: number;
  };
  remark: string;
}

// 设备分档数据
export const DEVICE_GRADE_DATA: DeviceGradeData[] = [
  {
    grade: 'A',
    yearlyFaultBase: 1,
    depreciationFactors: {
      1: 0.6,
      2: 0.8,
      3: 1,
      4: 1.3,
      5: 1.6
    },
    remark: '结构简单、即插即用，如烟感报警器、温湿度传感器'
  },
  {
    grade: 'B',
    yearlyFaultBase: 2,
    depreciationFactors: {
      1: 1.2,
      2: 1.6,
      3: 2,
      4: 2.6,
      5: 3.2
    },
    remark: '标准办公通用设备，具备基础网络连接功能'
  },
  {
    grade: 'C',
    yearlyFaultBase: 2.4,
    depreciationFactors: {
      1: 1.44,
      2: 1.92,
      3: 2.4,
      4: 3.12,
      5: 3.84
    },
    remark: '结构较复杂，涉及基础网动与光学组件'
  },
  {
    grade: 'D',
    yearlyFaultBase: 1.8,
    depreciationFactors: {
      1: 1.08,
      2: 1.44,
      3: 1.8,
      4: 2.34,
      5: 2.88
    },
    remark: '集成精密机电、光学扫描与复杂网络系统'
  },
  {
    grade: 'E',
    yearlyFaultBase: 1.2,
    depreciationFactors: {
      1: 0.72,
      2: 0.96,
      3: 1.2,
      4: 1.56,
      5: 1.92
    },
    remark: '大型精密设备、多模块或移动式业务主机'
  }
];

// 获取设备分档数据
export function getDeviceGradeData(grade: DeviceGrade): DeviceGradeData | undefined {
  return DEVICE_GRADE_DATA.find(d => d.grade === grade);
}

// 获取成新率系数
export function getDepreciationFactor(grade: DeviceGrade, depreciationGrade: DepreciationGrade): number {
  const gradeData = getDeviceGradeData(grade);
  return gradeData?.depreciationFactors[depreciationGrade] || 1;
}

// 设备分档选项
export const DEVICE_GRADE_OPTIONS: { value: DeviceGrade; label: string }[] = [
  { value: 'A', label: 'A档 - 结构简单、即插即用' },
  { value: 'B', label: 'B档 - 标准办公通用设备' },
  { value: 'C', label: 'C档 - 结构较复杂' },
  { value: 'D', label: 'D档 - 集成精密机电' },
  { value: 'E', label: 'E档 - 大型精密设备' }
];

// 成新率等级选项
export const DEPRECIATION_GRADE_OPTIONS: { value: DepreciationGrade; label: string }[] = [
  { value: 1, label: '1级 - 全新' },
  { value: 2, label: '2级 - 较新' },
  { value: 3, label: '3级 - 一般' },
  { value: 4, label: '4级 - 偏旧' },
  { value: 5, label: '5级 - 老旧' }
];
