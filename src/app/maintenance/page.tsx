'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  FileSpreadsheet, 
  FileText,
  Download, 
  Plus, 
  Trash2, 
  Save,
  Printer,
  Settings,
  Database,
  DollarSign,
  Clock,
  Shield,
  Wrench,
  CheckCircle2,
  AlertCircle,
  MapPin,
  List,
  ChevronUp,
  ChevronDown,
  Info,
} from 'lucide-react';
// 旧数据结构（保持向后兼容）
import {
  MOCK_DEVICE_QUOTAS,
  DeviceQuota,
  MaintenanceQuoteResult,
  calculateMaintenanceQuote,
  DepreciationLevel as OldDepreciationLevel,
  RegionType as OldRegionType,
  ServiceTimeType as OldServiceTimeType,
  SLAConfig as OldSLAConfig,
  DEFAULT_SLA_CONFIG as OLD_DEFAULT_SLA_CONFIG,
  MAINTENANCE_LEVEL_CONFIG,
  ENGINEER_PRICES,
  DEPRECIATION_FACTORS,
  REGION_FACTORS,
  MULTI_YEAR_DISCOUNTS,
  EngineerLevel,
} from '@/lib/maintenance-quota';
// 新完整数据结构
import {
  FULL_DEVICE_QUOTAS,
  getDeviceCategories,
  getDevicesByCategory,
  updateDeviceQuota,
} from '@/lib/complete-device-data';
import {
  calculateFullMaintenanceQuote,
  calculateFullDeviceQuote,
  formatCurrency,
  formatCurrencyDisplay,
  type FullMaintenanceQuoteResult,
  type FullDeviceQuoteItemResult,
} from '@/lib/maintenance-calculator-full';
import {
  DepreciationLevel,
  RegionType,
  ServiceTimeType,
  ArrivalTimeType,
  ResponseTimeType,
  SLAConfig,
  DEFAULT_SLA_CONFIG,
  FULL_MAINTENANCE_LEVEL_CONFIG,
  REGION_FACTORS as FULL_REGION_FACTORS,
  SERVICE_TIME_FACTORS,
  ARRIVAL_TIME_FACTORS,
  RESPONSE_TIME_FACTORS,
  calculateSLATotalFactor,
  type FullDeviceQuota,
} from '@/lib/device-quota-full';
import { getDepreciationFactor, type DeviceGrade, type DepreciationGrade } from '@/lib/device-grade';
import { 
  getTeamExperienceFactor, 
  getSecurityLevelFactor, 
  getSupportModeFactor, 
  getFaultRecoveryTimeFactor, 
  getArrivalTimeFactor, 
  getResponseTimeFactor, 
  getServiceTimeFactor,
} from '@/lib/sla-config';
import { ValueAddedServicesSelector } from '@/components/value-added-services-selector';
import { SurveyQuestionnaire } from '@/components/survey-questionnaire';
import type { SurveyAnswer } from '@/lib/survey-questions';
import { VALUE_ADDED_SERVICES, calculateValueAddedServicesTotal, type ValueAddedService } from '@/lib/value-added-services';
import {
  generateMaintenanceQuoteHTML,
  downloadAsWord,
  convertToChineseCurrency,
  type MaintenanceQuoteExportData,
} from '@/lib/export-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function MaintenanceQuotePage() {
  // 成新率等级映射：1级=全新，2级=较新，3级=一般，4级=偏旧，5级=老旧
  const DEPRECIATION_GRADE_MAP: Record<string, DepreciationLevel> = {
    '1': '全新',
    '2': '较新',
    '3': '一般',
    '4': '偏旧',
    '5': '老旧',
  };
  const DEPRECIATION_LEVEL_TO_GRADE: Record<DepreciationLevel, string> = {
    '全新': '1',
    '较新': '2',
    '一般': '3',
    '偏旧': '4',
    '老旧': '5',
  };

  const [activeTab, setActiveTab] = useState('new');
  const [quoteDate, setQuoteDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [contractYears, setContractYears] = useState<string>('1');
  const [region, setRegion] = useState<RegionType>('城区');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [engineerLevel, setEngineerLevel] = useState<EngineerLevel>('中级');
  
  // 使用新的完整数据结构的标志
  const [useFullData, setUseFullData] = useState(true);
  
  // 设备分类筛选 - 支持多选
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // SLA配置（使用新数据结构）
  const [slaConfig, setSlaConfig] = useState<SLAConfig>(DEFAULT_SLA_CONFIG);

  // 根据地区获取设备价格
  const getDevicePriceByRegion = (quota: FullDeviceQuota, currentRegion: RegionType) => {
    switch (currentRegion) {
      case '城区':
        return quota.cityPrice;
      case '市区县城郊区':
        return quota.urbanPrice;
      case '乡镇':
        return quota.townPrice;
      case '农村':
        return quota.ruralPrice;
      default:
        return quota.cityPrice;
    }
  };

  // 设备选择和数量（支持新老两种数据结构）
  type DeviceSLAConfig = {
    teamExperience: '有' | '类似' | '无';
    securityLevel: '一级' | '二级' | '三级' | '四级' | '五级';
    supportMode: '非现场支持为主' | '现场支持为主' | '纯现场支持';
    faultRecoveryTime: '≤4h' | '≤24h' | '≤48h' | '≤72h';
    arrivalTime: '2小时' | '8小时';
    responseTime: '10分钟' | '30分钟';
    serviceTime: '5×8' | '7×8' | '7×24';
  };
  
  type SelectedDevice = {
    quota: DeviceQuota | FullDeviceQuota;
    quantity: number;
    depreciationLevel: string;
    inWarranty: boolean;
    needSparePart: boolean;
    contractYears: number;
    deviceGrade: string;
    depreciationGrade: string;
    slaConfig?: DeviceSLAConfig;
  };
  
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevice[]>([]);

  // 计算结果（支持新老两种）
  const [quoteResult, setQuoteResult] = useState<MaintenanceQuoteResult | null>(null);
  const [fullQuoteResult, setFullQuoteResult] = useState<FullMaintenanceQuoteResult | null>(null);
  
  // 查勘问询
  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswer[]>([]);

  // 价格详情展开状态
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  
  // 当前选中的地区
  const [selectedRegionForSummary, setSelectedRegionForSummary] = useState<RegionType>('城区');

  // 设备定额库分页状态
  const [databasePage, setDatabasePage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // 编辑设备定额状态
  const [editingQuota, setEditingQuota] = useState<FullDeviceQuota | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // SLA配置状态
  const [slaConfigDevice, setSlaConfigDevice] = useState<SelectedDevice | null>(null);
  const [isSlaDialogOpen, setIsSlaDialogOpen] = useState(false);
  const [isNewSlaDevice, setIsNewSlaDevice] = useState(false);

  // 添加设备（支持新老两种数据结构）
  const handleAddDevice = (quota: DeviceQuota | FullDeviceQuota) => {
    const existing = selectedDevices.find(d => d.quota.id === quota.id);
    if (existing) {
      setSelectedDevices(selectedDevices.map(d => 
        d.quota.id === quota.id 
          ? { ...d, quantity: d.quantity + 1 }
          : d
      ));
    } else {
      const newDevice: SelectedDevice = {
        quota,
        quantity: 1,
        depreciationLevel: '1',
        inWarranty: false,
        needSparePart: false,
        contractYears: parseInt(contractYears),
        deviceGrade: 'A',
        depreciationGrade: '1',
        slaConfig: {
          teamExperience: '有',
          securityLevel: '二级',
          supportMode: '现场支持为主',
          faultRecoveryTime: '≤24h',
          arrivalTime: '8小时',
          responseTime: '30分钟',
          serviceTime: '5×8',
        },
      };
      // 先打开对话框
      setSlaConfigDevice(newDevice);
      setIsNewSlaDevice(true);
      setIsSlaDialogOpen(true);
    }
  };

  // 添加完整设备
  const handleAddFullDevice = (quota: FullDeviceQuota) => {
    const existing = selectedDevices.find(d => d.quota.id === quota.id);
    if (existing) {
      setSelectedDevices(selectedDevices.map(d => 
        d.quota.id === quota.id 
          ? { ...d, quantity: d.quantity + 1 }
          : d
      ));
    } else {
      const newDevice: SelectedDevice = {
        quota,
        quantity: 1,
        depreciationLevel: '1',
        inWarranty: false,
        needSparePart: quota.needSparePart || false,
        contractYears: parseInt(contractYears),
        deviceGrade: 'A',
        depreciationGrade: '1',
        slaConfig: {
          teamExperience: '有',
          securityLevel: '二级',
          supportMode: '现场支持为主',
          faultRecoveryTime: '≤24h',
          arrivalTime: '8小时',
          responseTime: '30分钟',
          serviceTime: '5×8',
        },
      };
      // 先打开对话框
      setSlaConfigDevice(newDevice);
      setIsNewSlaDevice(true);
      setIsSlaDialogOpen(true);
    }
  };

  // 更新设备数量
  const handleUpdateQuantity = (index: number, quantity: number) => {
    const newDevices = [...selectedDevices];
    newDevices[index].quantity = Math.max(0, quantity);
    if (newDevices[index].quantity === 0) {
      newDevices.splice(index, 1);
    }
    setSelectedDevices(newDevices);
  };

  // 更新成新率
  const handleUpdateDepreciation = (index: number, level: string) => {
    const newDevices = [...selectedDevices];
    newDevices[index].depreciationLevel = level as DepreciationLevel;
    newDevices[index].depreciationGrade = level;
    setSelectedDevices(newDevices);
  };

  // 更新在保状态
  const handleUpdateWarranty = (index: number, inWarranty: boolean) => {
    const newDevices = [...selectedDevices];
    newDevices[index].inWarranty = inWarranty;
    setSelectedDevices(newDevices);
  };
  
  // 更新是否需要备件
  const handleUpdateNeedSparePart = (index: number, needSparePart: boolean) => {
    const newDevices = [...selectedDevices];
    newDevices[index].needSparePart = needSparePart;
    setSelectedDevices(newDevices);
  };
  
  // 更新合同年限
  const handleUpdateContractYears = (index: number, years: number) => {
    const newDevices = [...selectedDevices];
    newDevices[index].contractYears = years;
    setSelectedDevices(newDevices);
  };

  // 更新设备分档
  const handleUpdateDeviceGrade = (index: number, grade: string) => {
    const newDevices = [...selectedDevices];
    newDevices[index].deviceGrade = grade;
    setSelectedDevices(newDevices);
  };

  // 格式化金额（使用新的格式化函数）
  const formatCurrencyLocal = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // 移除设备
  const handleRemoveDevice = (index: number) => {
    const newDevices = [...selectedDevices];
    newDevices.splice(index, 1);
    setSelectedDevices(newDevices);
  };

  // 计算报价（支持新老两种模式）
  const handleCalculate = () => {
    if (selectedDevices.length === 0) {
      alert('请先添加设备到设备列表！');
      return;
    }

    if (useFullData) {
      // 使用新的完整计算逻辑
      const fullDevices = selectedDevices.map(item => ({
        quota: item.quota as FullDeviceQuota,
        quantity: item.quantity,
        depreciationLevel: DEPRECIATION_GRADE_MAP[item.depreciationLevel] || '一般',
        deviceGrade: (item as any).deviceGrade || 'A',
        depreciationGrade: (item as any).depreciationGrade || '1',
        inWarranty: item.inWarranty,
        needSparePart: item.needSparePart,
        contractYears: item.contractYears,
      }));
      
      const result = calculateFullMaintenanceQuote(
        fullDevices,
        slaConfig,
        region
      );
      setFullQuoteResult(result);
      setQuoteResult(null);
    } else {
      // 使用旧的计算逻辑（向后兼容）
      const oldDevices = selectedDevices.map(item => ({
        quota: item.quota as DeviceQuota,
        quantity: item.quantity,
        depreciationLevel: (DEPRECIATION_GRADE_MAP[item.depreciationLevel] || '一般') as OldDepreciationLevel,
        inWarranty: item.inWarranty,
      }));
      
      const result = calculateMaintenanceQuote(
        oldDevices,
        slaConfig as unknown as OldSLAConfig,
        parseInt(contractYears),
        region as OldRegionType
      );
      setQuoteResult(result);
      setFullQuoteResult(null);
    }
  };

  // 监听合同年限或设备变化，自动重新计算报价
  useEffect(() => {
    if (selectedDevices.length > 0 && (quoteResult || fullQuoteResult)) {
      handleCalculate();
    }
  }, [contractYears, selectedDevices]);

  // 导出报价单 - 简化版本（导出Word）
  const handleExportQuote = () => {
    if (!quoteResult || selectedDevices.length === 0) {
      alert('请先添加设备并点击"计算报价"按钮后再导出！');
      return;
    }

    // 生成报价单号
    const timestamp = Date.now();
    const quoteNumber = `WB${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(timestamp % 1000).padStart(3, '0')}`;

    const activeQuoteResult = quoteResult;

    // 创建一个简单的导出数据
    const simpleExportData = {
      projectName,
      clientName,
      contactPerson,
      contactPhone,
      quoteNumber,
      quoteDate,
      engineerLevel: '中级',
      slaParams: {
        teamExperience: '有经验',
        securityLevel: '第二级',
        supportMethod: '远程+现场',
        recoveryTime: '24小时内',
        arrivalTime: '2小时内',
        responseTime: '10分钟内',
        serviceTime: '5×8小时',
      },
      totalSlaCoefficient: 1.0,
      region: '城区',
      regionCoefficient: 1.0,
      years: parseInt(contractYears),
      yearsDiscount: 1.0,
      equipmentCount: selectedDevices.reduce((sum, d) => sum + d.quantity, 0),
      bulkDiscount: 1.0,
      equipmentList: selectedDevices.map((device, index) => ({
        name: `设备${index + 1}`,
        category: '未分类',
        brand: '-',
        model: '-',
        quantity: device.quantity,
        maintenanceTier: 'C档 - 中级型',
        ageRate: '一般',
        ageCoefficient: 1.0,
        warrantyStatus: device.inWarranty ? '在保' : '过保',
        warrantyCoefficient: device.inWarranty ? 0.5 : 1.0,
        subtotalInspection: 0,
        subtotalOnsite: 0,
        subtotalRepair: 0,
        subtotalTools: 0,
        subtotalConsumables: 0,
        subtotalSpareParts: 0,
        subtotal: 0,
      })),
      summary: {
        totalInspection: 0,
        totalOnsite: 0,
        totalRepair: 0,
        totalTools: 0,
        totalConsumables: 0,
        totalSpareParts: 0,
        subtotalBeforeDiscount: activeQuoteResult.subtotal,
        slaAdjustment: 0,
        regionAdjustment: 0,
        subtotalAfterCoefficients: activeQuoteResult.subtotal,
        yearsDiscountAmount: 0,
        bulkDiscountAmount: 0,
        subtotal: activeQuoteResult.subtotal,
        tax: activeQuoteResult.taxAmount,
        grandTotal: activeQuoteResult.totalByYear[parseInt(contractYears) as 1 | 2 | 3],
        grandTotalRMB: convertToChineseCurrency(activeQuoteResult.totalByYear[parseInt(contractYears) as 1 | 2 | 3]),
      },
    };

    const html = generateMaintenanceQuoteHTML(simpleExportData);
    downloadAsWord(html, `维保报价单_${quoteNumber}.doc`);
  };

  // 保存报价
  const handleSaveQuote = () => {
    if ((!quoteResult && !fullQuoteResult) || selectedDevices.length === 0) {
      alert('请先添加设备并点击"计算报价"按钮后再保存！');
      return;
    }

    const timestamp = Date.now();
    const newQuoteNumber = `WB${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(timestamp % 1000).padStart(3, '0')}`;

    alert(`报价单 ${newQuoteNumber} 已保存！（当前保存到本地存储演示）`);
    console.log('保存报价单:', { newQuoteNumber, projectName, clientName, quoteResult, fullQuoteResult, selectedDevices });
  };

  // 导出Excel
  const handleExportExcel = () => {
    if ((!quoteResult && !fullQuoteResult) || selectedDevices.length === 0) {
      alert('请先添加设备并点击"计算报价"按钮后再导出！');
      return;
    }

    // 辅助函数：给表格添加样式
    const applyStylesToSheet = (sheet: XLSX.WorkSheet, data: any[]) => {
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      
      // 表头样式：深蓝色背景、白色字体、加粗
      const headerStyle = {
        fill: { fgColor: { rgb: '1e3a8a' } },
        font: { color: { rgb: 'ffffff' }, bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
      
      // 偶数行样式：浅蓝背景
      const evenRowStyle = {
        fill: { fgColor: { rgb: 'eff6ff' } },
        border: {
          top: { style: 'thin', color: { rgb: 'cccccc' } },
          bottom: { style: 'thin', color: { rgb: 'cccccc' } },
          left: { style: 'thin', color: { rgb: 'cccccc' } },
          right: { style: 'thin', color: { rgb: 'cccccc' } }
        }
      };
      
      // 奇数行样式：白色背景
      const oddRowStyle = {
        fill: { fgColor: { rgb: 'ffffff' } },
        border: {
          top: { style: 'thin', color: { rgb: 'cccccc' } },
          bottom: { style: 'thin', color: { rgb: 'cccccc' } },
          left: { style: 'thin', color: { rgb: 'cccccc' } },
          right: { style: 'thin', color: { rgb: 'cccccc' } }
        }
      };

      // 应用表头样式
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!sheet[cellAddress]) sheet[cellAddress] = { t: 's', v: '' };
        sheet[cellAddress].s = headerStyle;
      }

      // 应用数据行样式
      for (let row = 1; row <= data.length; row++) {
        const rowStyle = row % 2 === 0 ? evenRowStyle : oddRowStyle;
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!sheet[cellAddress]) sheet[cellAddress] = { t: 's', v: '' };
          sheet[cellAddress].s = rowStyle;
        }
      }
    };

    // 生成报价单号
    const timestamp = Date.now();
    const quoteNumber = `WB${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(timestamp % 1000).padStart(3, '0')}`;

    // 1. 设备清单Sheet
    const equipmentData = selectedDevices.map((device, index) => ({
      '序号': index + 1,
      '设备名称': device.quota.name,
      '规格型号': device.quota.model,
      '数量': device.quantity,
      '成新率': device.depreciationLevel,
      '设备分档': device.deviceGrade,
      '在保状态': device.inWarranty ? '在保' : '过保',
      '需要备件': device.needSparePart ? '是' : '否',
      '合同年限': `${device.contractYears}年`,
      '运维团队经验': device.slaConfig?.teamExperience || '-',
      '安全等级': device.slaConfig?.securityLevel || '-',
      '支持方式': device.slaConfig?.supportMode || '-',
      '故障恢复时间': device.slaConfig?.faultRecoveryTime || '-',
      '到场时间': device.slaConfig?.arrivalTime || '-',
      '响应时间': device.slaConfig?.responseTime || '-',
      '服务时间': device.slaConfig?.serviceTime || '-',
    }));

    // 2. 设备报价明细Sheet
    let equipmentQuoteData: any[] = [];
    if (useFullData && fullQuoteResult) {
      equipmentQuoteData = fullQuoteResult.deviceItems.map((item, index) => ({
        '序号': index + 1,
        '设备名称': item.quota.name,
        '成新率': item.depreciationLevel,
        '设备分档': item.deviceGrade,
        '数量': item.quantity,
        '巡检时长（分钟）': item.inspectionDuration,
        '巡检费': formatCurrencyLocal(item.inspectionFee),
        '上门费': formatCurrencyLocal(item.onSiteFee),
        '故障处理费': formatCurrencyLocal(item.faultHandlingFee),
        '工具仪表摊销': formatCurrencyLocal(item.toolAmortization),
        '耗材费': formatCurrencyLocal(item.consumableFee),
        '备件风险准备金': formatCurrencyLocal(item.sparePartReserve),
        '单价（城区）': formatCurrencyLocal(item.cityPrice),
        '小计（城区）': formatCurrencyLocal(item.totalAfterDiscount),
      }));
    } else if (quoteResult) {
      equipmentQuoteData = quoteResult.deviceItems.map((item, index) => ({
        '序号': index + 1,
        '设备名称': item.quota.name,
        '成新率': (item as any).depreciationLevel || '-',
        '设备分档': (item as any).deviceGrade || '-',
        '数量': item.quantity,
        '巡检时长（分钟）': (item as any).inspectionDuration || item.quota.inspectionDuration,
        '巡检费': formatCurrencyLocal(item.inspectionFee),
        '上门费': formatCurrencyLocal(item.onSiteFee),
        '故障处理费': formatCurrencyLocal(item.faultHandlingFee),
        '工具仪表摊销': formatCurrencyLocal(item.toolAmortization),
        '耗材费': formatCurrencyLocal(item.consumableFee),
        '备件风险准备金': formatCurrencyLocal(item.sparePartReserve),
        '单价': formatCurrencyLocal(item.cityPrice),
        '小计': formatCurrencyLocal(item.totalAfterDiscount),
      }));
    }

    // 3. 费用总结Sheet
    let summaryData: any[] = [];
    if (useFullData && fullQuoteResult) {
      // 计算当前选中地区的详细费用
      const regionFactor = FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS];
      const totalInspection = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.inspectionFee * item.quantity * regionFactor, 0);
      const totalOnSite = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.onSiteFee * item.quantity * regionFactor, 0);
      const totalFaultHandling = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.faultHandlingFee * item.quantity * regionFactor, 0);
      const totalTools = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.toolAmortization * item.quantity * regionFactor, 0);
      const totalConsumables = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.consumableFee * item.quantity * regionFactor, 0);
      const totalSpareParts = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.sparePartReserve * item.quantity * regionFactor, 0);
      
      const totalInspectionDuration = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.inspectionDuration * item.quantity, 0);
      const totalDevices = fullQuoteResult.totalDevices;
      
      summaryData = [
        { '项目': '客户名称', '内容': clientName || '-' },
        { '项目': '项目名称', '内容': projectName || '-' },
        { '项目': '联系人', '内容': contactPerson || '-' },
        { '项目': '联系电话', '内容': contactPhone || '-' },
        { '项目': '报价日期', '内容': quoteDate || '-' },
        { '项目': '合同年限', '内容': `${contractYears}年` },
        { '项目': '当前显示地区', '内容': selectedRegionForSummary },
        { '项目': '', '内容': '' },
        { '项目': '统计信息', '内容': '' },
        { '项目': '设备总数', '内容': totalDevices },
        { '项目': '总巡检时长', '内容': `${totalInspectionDuration}分钟` },
        { '项目': '', '内容': '' },
        { '项目': '费用明细汇总', '内容': '' },
        { '项目': '巡检费合计', '内容': formatCurrencyLocal(totalInspection) },
        { '项目': '上门费合计', '内容': formatCurrencyLocal(totalOnSite) },
        { '项目': '故障处理费合计', '内容': formatCurrencyLocal(totalFaultHandling) },
        { '项目': '工具仪表摊销', '内容': formatCurrencyLocal(totalTools) },
        { '项目': '耗材费合计', '内容': formatCurrencyLocal(totalConsumables) },
        { '项目': '备件风险准备金', '内容': formatCurrencyLocal(totalSpareParts) },
        { '项目': '', '内容': '' },
        { '项目': '小计（不含税）', '内容': formatCurrencyLocal(fullQuoteResult.totalByRegion[selectedRegionForSummary].subtotal) },
        { '项目': '税额', '内容': formatCurrencyLocal(fullQuoteResult.totalByRegion[selectedRegionForSummary].taxAmount) },
        { '项目': '', '内容': '' },
        { '项目': '第一年总价', '内容': formatCurrencyLocal(fullQuoteResult.totalByYear[1]) },
        { '项目': '第二年总价', '内容': formatCurrencyLocal(fullQuoteResult.totalByYear[2]) },
        { '项目': '第三年总价', '内容': formatCurrencyLocal(fullQuoteResult.totalByYear[3]) },
      ];
    } else if (quoteResult) {
      const totalDevices = quoteResult.deviceItems.reduce((sum, d) => sum + d.quantity, 0);
      summaryData = [
        { '项目': '客户名称', '内容': clientName || '-' },
        { '项目': '项目名称', '内容': projectName || '-' },
        { '项目': '联系人', '内容': contactPerson || '-' },
        { '项目': '联系电话', '内容': contactPhone || '-' },
        { '项目': '报价日期', '内容': quoteDate || '-' },
        { '项目': '合同年限', '内容': `${contractYears}年` },
        { '项目': '', '内容': '' },
        { '项目': '统计信息', '内容': '' },
        { '项目': '设备总数', '内容': totalDevices },
        { '项目': '', '内容': '' },
        { '项目': '小计（不含税）', '内容': formatCurrencyLocal((quoteResult as any).subtotalAfterDiscount || 0) },
        { '项目': '税额', '内容': formatCurrencyLocal(quoteResult.taxAmount) },
        { '项目': '', '内容': '' },
        { '项目': '第一年总价', '内容': formatCurrencyLocal(quoteResult.totalByYear[1]) },
        { '项目': '第二年总价', '内容': formatCurrencyLocal(quoteResult.totalByYear[2]) },
        { '项目': '第三年总价', '内容': formatCurrencyLocal(quoteResult.totalByYear[3]) },
      ];
    }

    // 4. 分地区报价Sheet
    let regionQuoteData: any[] = [];
    if (useFullData && fullQuoteResult) {
      regionQuoteData = Object.entries(fullQuoteResult.totalByRegion).map(([region, data]) => ({
        '地区': region,
        '地区系数': FULL_REGION_FACTORS[region as keyof typeof FULL_REGION_FACTORS],
        '不含税小计': formatCurrencyLocal(data.subtotal),
        '税额': formatCurrencyLocal(data.taxAmount),
        '含税总价': formatCurrencyLocal(data.total),
      }));
      
      // 添加各年总价
      regionQuoteData.push({ '地区': '', '地区系数': '', '不含税小计': '', '税额': '', '含税总价': '' });
      regionQuoteData.push({ '地区': '年度总价', '地区系数': '', '不含税小计': '', '税额': '', '含税总价': '' });
      regionQuoteData.push({ '地区': '第一年', '地区系数': '', '不含税小计': '', '税额': '', '含税总价': formatCurrencyLocal(fullQuoteResult.totalByYear[1]) });
      regionQuoteData.push({ '地区': '第二年', '地区系数': '', '不含税小计': '', '税额': '', '含税总价': formatCurrencyLocal(fullQuoteResult.totalByYear[2]) });
      regionQuoteData.push({ '地区': '第三年', '地区系数': '', '不含税小计': '', '税额': '', '含税总价': formatCurrencyLocal(fullQuoteResult.totalByYear[3]) });
    }

    // 5. 费用明细Sheet（与页面显示一致）
    let costDetailData: any[] = [];
    if (useFullData && fullQuoteResult) {
      costDetailData = fullQuoteResult.deviceItems.map((item, index) => ({
        '设备名称': item.quota.name,
        '成新率': item.depreciationLevel,
        '设备分档': item.deviceGrade,
        '数量': item.quantity,
        '巡检时长（分钟）': item.inspectionDuration,
        '巡检费': formatCurrencyLocal(item.inspectionFee * item.quantity * FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS]),
        '上门费': formatCurrencyLocal(item.onSiteFee * item.quantity * FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS]),
        '故障处理费': formatCurrencyLocal(item.faultHandlingFee * item.quantity * FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS]),
        '工具仪表摊销': formatCurrencyLocal(item.toolAmortization * item.quantity * FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS]),
        '耗材费': formatCurrencyLocal(item.consumableFee * item.quantity * FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS]),
        '备件风险准备金': formatCurrencyLocal(item.sparePartReserve * item.quantity * FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS]),
        '单价': formatCurrencyLocal(item.cityPrice * FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS]),
        '小计': formatCurrencyLocal(item.totalAfterDiscount * FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS]),
      }));
    } else if (quoteResult) {
      costDetailData = quoteResult.deviceItems.map((item, index) => ({
        '设备名称': item.quota.name,
        '成新率': (item as any).depreciationLevel || '-',
        '设备分档': (item as any).deviceGrade || '-',
        '数量': item.quantity,
        '巡检时长（分钟）': (item as any).inspectionDuration || item.quota.inspectionDuration,
        '巡检费': formatCurrencyLocal(item.inspectionFee * item.quantity),
        '上门费': formatCurrencyLocal(item.onSiteFee * item.quantity),
        '故障处理费': formatCurrencyLocal(item.faultHandlingFee * item.quantity),
        '工具仪表摊销': formatCurrencyLocal(item.toolAmortization * item.quantity),
        '耗材费': formatCurrencyLocal(item.consumableFee * item.quantity),
        '备件风险准备金': formatCurrencyLocal(item.sparePartReserve * item.quantity),
        '单价': formatCurrencyLocal(item.cityPrice),
        '小计': formatCurrencyLocal(item.totalAfterDiscount),
      }));
    }

    // 创建Workbook - 合并所有数据到一个Sheet
    const workbook = XLSX.utils.book_new();
    
    // 合并所有数据到一个数组
    const allData: any[] = [];
    
    // 基本信息
    allData.push({ "": "维保报价单", " ": "" });
    allData.push({ "": "", " ": "" });
    allData.push({ "": "客户名称", " ": clientName || "-" });
    allData.push({ "": "项目名称", " ": projectName || "-" });
    allData.push({ "": "报价日期", " ": quoteDate || "-" });
    allData.push({ "": "报价单号", " ": quoteNumber });
    allData.push({ "": "", " ": "" });
    
    // 设备清单
    allData.push({ "": "设备清单", " ": "" });
    equipmentData.forEach(item => allData.push(item));
    allData.push({ "": "", " ": "" });
    
    // 设备报价明细
    allData.push({ "": "设备报价明细", " ": "" });
    equipmentQuoteData.forEach(item => allData.push(item));
    allData.push({ "": "", " ": "" });
    
    // 费用汇总
    allData.push({ "": "费用汇总", " ": "" });
    summaryData.forEach(item => allData.push(item));
    allData.push({ "": "", " ": "" });
    
    // 分地区报价
    allData.push({ "": "分地区报价", " ": "" });
    regionQuoteData.forEach(item => allData.push(item));
    allData.push({ "": "", " ": "" });
    
    // 费用明细
    allData.push({ "": "费用明细", " ": "" });
    costDetailData.forEach(item => allData.push(item));
    
    // 创建Sheet并下载
    const sheet = XLSX.utils.json_to_sheet(allData);
    sheet["!cols"] = [{ wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "维保报价单");
    XLSX.writeFile(workbook, `维保报价单_${quoteNumber}.xlsx`);
  };

  // 自动计算
  useEffect(() => {
    if (selectedDevices.length > 0) {
      handleCalculate();
    } else {
      setQuoteResult(null);
      setFullQuoteResult(null);
    }
  }, [selectedDevices, slaConfig, contractYears, region, useFullData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">维保报价</h1>
          <p className="text-slate-500 mt-1">基于设备维保定额库的专业报价系统</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            导出Excel
          </Button>
          <Button className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800" onClick={handleCalculate}>
            <Calculator className="h-4 w-4" />
            计算报价
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            新建报价
          </TabsTrigger>
          <TabsTrigger value="survey" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            查勘问询
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            设备定额库
          </TabsTrigger>
          <TabsTrigger value="sla" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            SLA参数配置
          </TabsTrigger>
          <TabsTrigger value="value-added" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            增值服务
          </TabsTrigger>
        </TabsList>
        
        {/* 数据模式切换 */}
        <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <Switch
              checked={useFullData}
              onCheckedChange={setUseFullData}
            />
            <Label className="font-medium">使用完整计算逻辑</Label>
            <Badge variant="outline" className={useFullData ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-600"}>
              {useFullData ? "新版 (完整65列)" : "旧版 (兼容)"}
            </Badge>
          </div>
          {useFullData && (
            <div className="text-sm text-slate-500">
              支持4个地区报价 · 完全复刻Excel公式
            </div>
          )}
        </div>

        {/* 新建报价 */}
        <TabsContent value="new" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* 基本信息 */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  基本信息
                </CardTitle>
                <CardDescription>填写报价单的基本信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quoteDate">报价日期</Label>
                  <Input
                    id="quoteDate"
                    type="date"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerName">客户名称</Label>
                  <Input
                    id="customerName"
                    placeholder="请输入客户名称"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectName">项目名称</Label>
                  <Input
                    id="projectName"
                    placeholder="请输入项目名称"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractYears">合同年限</Label>
                  <Select value={contractYears} onValueChange={setContractYears}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择合同年限" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1年</SelectItem>
                      <SelectItem value="2">2年 (95折)</SelectItem>
                      <SelectItem value="3">3年 (9折)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">服务地区</Label>
                  <Select value={region} onValueChange={(v) => setRegion(v as RegionType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择服务地区" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="城区">城区 (系数1.0)</SelectItem>
                      <SelectItem value="市区县城郊区">市区县城郊区 (系数1.1)</SelectItem>
                      <SelectItem value="乡镇">乡镇 (系数1.5)</SelectItem>
                      <SelectItem value="农村">农村 (系数2.0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* 设备清单 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  设备清单
                </CardTitle>
                <CardDescription>添加维保设备并设置参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 设备选择器（支持新老数据） */}
                <div className="space-y-2">
                  <Label>从定额库选择设备</Label>
                  
                  {/* 设备分类筛选（仅新版） - 多选模式 */}
                  {useFullData && (
                    <div className="space-y-2 mb-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">设备分类</Label>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => setSelectedCategories([])}
                          >
                            清除选择
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => setSelectedCategories(getDeviceCategories())}
                          >
                            全选
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {getDeviceCategories().map((category) => (
                          <label 
                            key={category} 
                            className="flex items-center gap-2 p-2 border rounded-md hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(category)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCategories([...selectedCategories, category]);
                                } else {
                                  setSelectedCategories(selectedCategories.filter(c => c !== category));
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <span className="text-sm">
                              {category}
                              <span className="text-xs text-slate-500 ml-1">
                                ({getDevicesByCategory(category).length})
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                    {useFullData ? (
                      // 新版：使用完整设备数据（按分类筛选 - 多选）
                      (() => {
                        const filteredDevices = selectedCategories.length === 0 
                          ? FULL_DEVICE_QUOTAS 
                          : FULL_DEVICE_QUOTAS.filter(d => selectedCategories.includes(d.category));
                        
                        return (
                          <>
                            {filteredDevices.length === 0 && (
                              <div className="col-span-full text-center py-4 text-slate-500 text-sm">
                                {selectedCategories.length === 0 ? '请选择设备分类' : '所选分类下暂无设备'}
                              </div>
                            )}
                            {filteredDevices.map((quota) => (
                              <Button
                                key={quota.id}
                                variant="outline"
                                className="justify-start text-left h-auto py-2 px-3"
                                onClick={() => handleAddFullDevice(quota as FullDeviceQuota)}
                              >
                                <div className="flex flex-col items-start">
                                  <span className="font-medium text-sm">{quota.name}</span>
                                  <span className="text-xs text-slate-500">{quota.model}</span>
                                  <div className="flex gap-1 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {quota.levelName}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                      {formatCurrencyLocal(getDevicePriceByRegion(quota as FullDeviceQuota, region))}
                                    </Badge>
                                  </div>
                                </div>
                              </Button>
                            ))}
                          </>
                        );
                      })()
                    ) : (
                      // 旧版：保持向后兼容
                      MOCK_DEVICE_QUOTAS.map((quota) => (
                        <Button
                          key={quota.id}
                          variant="outline"
                          className="justify-start text-left h-auto py-2 px-3"
                          onClick={() => handleAddDevice(quota)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-sm">{quota.name}</span>
                            <span className="text-xs text-slate-500">{quota.model}</span>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {MAINTENANCE_LEVEL_CONFIG[quota.level].name}
                            </Badge>
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                </div>

                {/* 已选设备列表 */}
                {selectedDevices.length > 0 && (
                  <div className="mt-6">
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>设备名称</TableHead>
                            <TableHead>规格型号</TableHead>
                            <TableHead>数量</TableHead>
                            <TableHead>成新率</TableHead>
                            <TableHead>在保状态</TableHead>
                            <TableHead>需要备件</TableHead>
                            <TableHead>合同年限</TableHead>
                            <TableHead>设备分档</TableHead>
                            <TableHead>折旧系数</TableHead>
                            {/* 新版：显示4个地区报价表头 */}
                            {useFullData && (
                              <>
                                <TableHead className="text-right">城区</TableHead>
                                <TableHead className="text-right text-xs">市区</TableHead>
                              </>
                            )}
                            {/* 旧版：只显示单价 */}
                            {!useFullData && (
                              <TableHead>单价</TableHead>
                            )}
                            <TableHead>小计</TableHead>
                            <TableHead className="w-24">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDevices.map((item, index) => (
                            <TableRow key={item.quota.id}>
                              <TableCell className="font-medium">{item.quota.name}</TableCell>
                              <TableCell className="text-slate-500">{item.quota.model}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateQuantity(index, parseInt(e.target.value) || 0)}
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={item.depreciationLevel}
                                  onValueChange={(v) => handleUpdateDepreciation(index, v)}
                                >
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1级（全新）</SelectItem>
                                    <SelectItem value="2">2级（较新）</SelectItem>
                                    <SelectItem value="3">3级（一般）</SelectItem>
                                    <SelectItem value="4">4级（偏旧）</SelectItem>
                                    <SelectItem value="5">5级（老旧）</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={item.inWarranty}
                                  onCheckedChange={(checked) => handleUpdateWarranty(index, checked)}
                                />
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={item.needSparePart}
                                  onCheckedChange={(checked) => handleUpdateNeedSparePart(index, checked)}
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={String(item.contractYears)}
                                  onValueChange={(v) => handleUpdateContractYears(index, parseInt(v))}
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1年</SelectItem>
                                    <SelectItem value="2">2年</SelectItem>
                                    <SelectItem value="3">3年</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={item.deviceGrade}
                                  onValueChange={(v) => handleUpdateDeviceGrade(index, v)}
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="A">A档</SelectItem>
                                    <SelectItem value="B">B档</SelectItem>
                                    <SelectItem value="C">C档</SelectItem>
                                    <SelectItem value="D">D档</SelectItem>
                                    <SelectItem value="E">E档</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-purple-50 text-purple-700">
                                  {getDepreciationFactor((item.deviceGrade || 'C') as DeviceGrade, Number(item.depreciationGrade || '1') as DepreciationGrade).toFixed(2)}
                                </Badge>
                              </TableCell>
                              {/* 新版：显示4个地区报价 */}
                              {useFullData && 'cityPrice' in item.quota && (
                                <>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                        {formatCurrencyLocal((item.quota as FullDeviceQuota).cityPrice)}
                                      </Badge>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-slate-400 hover:text-slate-600 cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                            <div className="space-y-2">
                                              <p className="font-semibold">单价组成</p>
                                              <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                  <span>巡检人工费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).inspectionLaborFee)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>上门费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).onSiteFeeAnnual)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>故障处理费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).faultHandlingFeeTotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>工具摊销</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).toolAmortization)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>耗材费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).consumableFee)}</span>
                                                </div>
                                                {item.needSparePart && (
                                                  <div className="flex justify-between">
                                                    <span>备件准备金</span>
                                                    <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).sparePartReserve)}</span>
                                                  </div>
                                                )}
                                              </div>
                                              <div className="pt-2 border-t">
                                                <p className="font-semibold text-xs">比例系数</p>
                                                <div className="space-y-1 text-xs mt-1">
                                                  <div className="flex justify-between">
                                                    <span>设备分档</span>
                                                    <span>{(item.deviceGrade || 'A')}</span>
                                                  </div>
                                                  <div className="flex justify-between">
                                                    <span>成新率等级</span>
                                                    <span>{(item.depreciationGrade || '1')}级</span>
                                                  </div>
                                                  <div className="flex justify-between">
                                                    <span>折旧系数</span>
                                                    <span>{getDepreciationFactor((item.deviceGrade || 'A') as DeviceGrade, (Number(item.depreciationGrade) || 1) as unknown as DepreciationGrade).toFixed(2)}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </TableCell>
                                  {/* 城区列，添加单价组成Info */}
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {formatCurrencyLocal((item.quota as FullDeviceQuota).cityPrice)}
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-slate-400 hover:text-slate-600 cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                            <div className="space-y-2">
                                              <p className="font-semibold">单价组成</p>
                                              <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                  <span>巡检人工费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).inspectionLaborFee)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>上门费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).onSiteFeeAnnual)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>故障处理费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).faultHandlingFeeTotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>工具摊销</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).toolAmortization)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>耗材费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).consumableFee)}</span>
                                                </div>
                                                {item.needSparePart && (
                                                  <div className="flex justify-between">
                                                    <span>备件准备金</span>
                                                    <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).sparePartReserve)}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </TableCell>
                                  {/* 市区列，添加单价组成Info */}
                                  <TableCell className="text-right text-xs text-slate-500">
                                    <div className="flex items-center justify-end gap-1">
                                      {formatCurrencyLocal((item.quota as FullDeviceQuota).urbanPrice)}
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-slate-400 hover:text-slate-600 cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                            <div className="space-y-2">
                                              <p className="font-semibold">单价组成</p>
                                              <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                  <span>巡检人工费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).inspectionLaborFee)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>上门费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).onSiteFeeAnnual)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>故障处理费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).faultHandlingFeeTotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>工具摊销</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).toolAmortization)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>耗材费</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).consumableFee)}</span>
                                                </div>
                                                {item.needSparePart && (
                                                  <div className="flex justify-between">
                                                    <span>备件准备金</span>
                                                    <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).sparePartReserve)}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </TableCell>
                                </>
                              )}
                              {/* 旧版：只显示城区报价，添加单价组成Info */}
                              {!useFullData && (
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {formatCurrencyLocal(item.quota.cityPrice)}
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-4 w-4 text-slate-400 hover:text-slate-600 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <div className="space-y-2">
                                            <p className="font-semibold">单价组成</p>
                                            <div className="space-y-1 text-xs">
                                              <div className="flex justify-between">
                                                <span>巡检人工费</span>
                                                <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).inspectionLaborFee)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span>上门费</span>
                                                <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).onSiteFeeAnnual)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span>故障处理费</span>
                                                <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).faultHandlingFeeTotal)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span>工具摊销</span>
                                                <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).toolAmortization)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span>耗材费</span>
                                                <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).consumableFee)}</span>
                                              </div>
                                              {item.needSparePart && (
                                                <div className="flex justify-between">
                                                  <span>备件准备金</span>
                                                  <span>{formatCurrencyLocal((item.quota as FullDeviceQuota).sparePartReserve)}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                              )}
                              <TableCell className="font-medium">
                                {formatCurrencyLocal(item.quota.cityPrice * item.quantity)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSlaConfigDevice(item);
                                      setIsNewSlaDevice(false);
                                      setIsSlaDialogOpen(true);
                                    }}
                                    title="配置SLA参数"
                                  >
                                    <Settings className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveDevice(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 计算结果 - 支持新老两种模式 */}
            {(quoteResult || fullQuoteResult) && (
              <Card className="lg:col-span-3">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-green-600" />
                        报价计算结果
                        {useFullData && (
                          <Badge className="bg-green-100 text-green-700">完整计算逻辑</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {useFullData ? '完全复刻Excel公式，支持4个地区报价' : '基于维保定额库的专业报价'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* 费用明细 */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">费用明细</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>设备名称</TableHead>
                            <TableHead>成新率</TableHead>
                            <TableHead>设备分档</TableHead>
                            <TableHead>数量</TableHead>
                            <TableHead>巡检时长（分钟）</TableHead>
                            <TableHead>巡检费</TableHead>
                            <TableHead>上门费</TableHead>
                            <TableHead>故障处理费</TableHead>
                            <TableHead>工具仪表摊销</TableHead>
                            <TableHead>耗材费</TableHead>
                            <TableHead>备件风险准备金</TableHead>
                            <TableHead className="text-right">单价</TableHead>
                            <TableHead className="text-right">小计</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {useFullData && fullQuoteResult ? (
                            // 新版：完整计算结果
                            fullQuoteResult.deviceItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.quota.name}</TableCell>
                                <TableCell>{item.depreciationLevel}</TableCell>
                                <TableCell>{item.deviceGrade}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{(item as any).inspectionDuration || item.quota.inspectionDuration}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.inspectionFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.onSiteFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.faultHandlingFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.toolAmortization)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.consumableFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.sparePartReserve)}</TableCell>
                                <TableCell className="text-right">{formatCurrencyLocal(item.cityPrice)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrencyLocal(item.totalAfterDiscount)}</TableCell>
                              </TableRow>
                            ))
                          ) : quoteResult ? (
                            // 旧版：保持向后兼容
                            quoteResult.deviceItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.quota.name}</TableCell>
                                <TableCell>{(item as any).depreciationLevel || '-'}</TableCell>
                                <TableCell>{(item as any).deviceGrade || '-'}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{(item as any).inspectionDuration || item.quota.inspectionDuration}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.inspectionFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.onSiteFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.faultHandlingFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.toolAmortization)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.consumableFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.sparePartReserve)}</TableCell>
                                <TableCell className="text-right">{formatCurrencyLocal(item.cityPrice)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrencyLocal(item.totalAfterDiscount)}</TableCell>
                              </TableRow>
                            ))
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>

                    {/* 费用总结和分地区报价并排显示 */}
                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                      {/* 费用总结板块 */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          费用总结
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {useFullData && fullQuoteResult ? (
                          <div className="space-y-4">
                            {/* 选中地区提示 */}
                            <div className="p-2 bg-blue-50 rounded text-sm text-blue-700 flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              当前显示：<strong>{selectedRegionForSummary}</strong> 的费用总结（点击右侧分地区报价可切换）
                            </div>
                            
                            {/* 统计信息 */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="text-sm text-blue-600 font-medium">设备总数</div>
                                <div className="text-2xl font-bold text-blue-700">{fullQuoteResult.totalDevices}</div>
                              </div>
                              <div className="p-3 bg-cyan-50 rounded-lg">
                                <div className="text-sm text-cyan-600 font-medium">总巡检时长</div>
                                <div className="text-xl font-bold text-cyan-700">
                                  {fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.inspectionDuration * item.quantity, 0)}分钟
                                </div>
                              </div>
                              <div className="p-3 bg-green-50 rounded-lg">
                                <div className="text-sm text-green-600 font-medium">不含税总价</div>
                                <div className="text-xl font-bold text-green-700">
                                  {formatCurrencyLocal(fullQuoteResult.totalByRegion[selectedRegionForSummary].subtotal)}
                                </div>
                              </div>
                              <div className="p-3 bg-purple-50 rounded-lg">
                                <div className="text-sm text-purple-600 font-medium">含税总价</div>
                                <div className="text-xl font-bold text-purple-700">
                                  {formatCurrencyLocal(fullQuoteResult.totalByRegion[selectedRegionForSummary].total)}
                                </div>
                              </div>
                            </div>

                            {/* 各项费用明细汇总 */}
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>费用项目</TableHead>
                                    <TableHead className="text-right">金额</TableHead>
                                    <TableHead className="text-right">占比</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(() => {
                                    // 根据选中地区计算各项费用
                                    const getRegionPrice = (item: any, region: RegionType) => {
                                      switch(region) {
                                        case '城区': return item.cityPrice;
                                        case '市区县城郊区': return item.urbanPrice;
                                        case '乡镇': return item.townPrice;
                                        case '农村': return item.ruralPrice;
                                        default: return item.cityPrice;
                                      }
                                    };
                                    
                                    const regionFactor = FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS];
                                    const totalInspectionFee = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.inspectionFee * item.quantity * regionFactor, 0);
                                    const totalOnSiteFee = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.onSiteFee * item.quantity * regionFactor, 0);
                                    const totalFaultHandlingFee = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.faultHandlingFee * item.quantity * regionFactor, 0);
                                    const totalToolAmortization = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.toolAmortization * item.quantity * regionFactor, 0);
                                    const totalConsumableFee = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.consumableFee * item.quantity * regionFactor, 0);
                                    const totalSparePartReserve = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.sparePartReserve * item.quantity * regionFactor, 0);
                                    const totalSubtotal = fullQuoteResult.totalByRegion[selectedRegionForSummary].subtotal;

                                    const feeItems = [
                                      { name: '巡检费', amount: totalInspectionFee },
                                      { name: '上门费', amount: totalOnSiteFee },
                                      { name: '故障处理费', amount: totalFaultHandlingFee },
                                      { name: '工具仪表摊销', amount: totalToolAmortization },
                                      { name: '耗材费', amount: totalConsumableFee },
                                      { name: '备件风险准备金', amount: totalSparePartReserve },
                                    ];

                                    return feeItems.map((item, index) => (
                                      <TableRow key={index}>
                                        <TableCell className="font-medium text-sm">{item.name}</TableCell>
                                        <TableCell className="text-right text-sm">{formatCurrencyLocal(item.amount)}</TableCell>
                                        <TableCell className="text-right text-sm">
                                          {totalSubtotal > 0 ? `${((item.amount / totalSubtotal) * 100).toFixed(1)}%` : '-'}
                                        </TableCell>
                                      </TableRow>
                                    ));
                                  })()}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ) : quoteResult ? (
                          <div className="space-y-4">
                            {/* 旧版统计信息 */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="text-sm text-blue-600 font-medium">设备总数</div>
                                <div className="text-2xl font-bold text-blue-700">
                                  {quoteResult.deviceItems.reduce((sum, item) => sum + item.quantity, 0)}
                                </div>
                              </div>
                              <div className="p-3 bg-cyan-50 rounded-lg">
                                <div className="text-sm text-cyan-600 font-medium">不含税总价</div>
                                <div className="text-2xl font-bold text-cyan-700">
                                  {formatCurrencyLocal((quoteResult as any).subtotalAfterDiscount || 0)}
                                </div>
                              </div>
                              <div className="p-3 bg-purple-50 rounded-lg">
                                <div className="text-sm text-purple-600 font-medium">含税总价</div>
                                <div className="text-2xl font-bold text-purple-700">
                                  {formatCurrencyLocal((quoteResult as any).finalTotal || 0)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    {/* 汇总信息 */}
                    <div className="space-y-4">
                      {/* 新版：4个地区报价展示 */}
                      {useFullData && fullQuoteResult && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              分地区报价
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {Object.entries(fullQuoteResult.totalByRegion).map(([region, data]) => (
                              <div 
                                key={region} 
                                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                                  selectedRegionForSummary === region 
                                    ? 'bg-blue-100 border-2 border-blue-400' 
                                    : 'bg-slate-50 hover:bg-slate-100'
                                }`}
                                onClick={() => setSelectedRegionForSummary(region as RegionType)}
                              >
                                <div className="flex justify-between items-center">
                                  <span className={`font-medium ${selectedRegionForSummary === region ? 'text-blue-800' : ''}`}>{region}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-lg font-bold ${selectedRegionForSummary === region ? 'text-blue-800' : 'text-blue-700'}`}>
                                      {formatCurrencyLocal(data.total)}
                                    </span>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                            <Info className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <div className="space-y-1">
                                            <div className="font-medium">价格计算方式：</div>
                                            <div className="text-xs space-y-1">
                                              <p>• 价格 = ∑(单台设备价格 × 数量) × 地区系数</p>
                                              <p>• 单台设备价格 = 基准单价 × SLA系数 × 折旧系数 × 是否在保系数</p>
                                              <p>• 地区系数：{FULL_REGION_FACTORS[region as keyof typeof FULL_REGION_FACTORS]}</p>
                                              <p>• 税率：13%增值税</p>
                                            </div>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setExpandedRegion(expandedRegion === region ? null : region)}
                                      className="h-7 px-2"
                                    >
                                      {expandedRegion === region ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  不含税: {formatCurrencyLocal(data.subtotal)} · 
                                  税额: {formatCurrencyLocal(data.taxAmount)}
                                </div>
                                
                                {/* 展开的详细内容 */}
                                {expandedRegion === region && (
                                  <div className="mt-3 p-3 bg-white rounded border border-slate-200">
                                    <div className="space-y-2 text-sm">
                                      <div className="font-medium mb-2">价格构成说明：</div>
                                      <div className="text-slate-600">
                                        <p><strong>1. 地区系数：</strong>该地区系数为 {FULL_REGION_FACTORS[region as keyof typeof FULL_REGION_FACTORS]}，根据地区服务成本计算</p>
                                        <p><strong>2. SLA系数构成：</strong></p>
                                        <div className="ml-4 space-y-1 text-xs">
                                          <p>• 团队经验系数：{slaConfig.teamExperience} (×{slaConfig.teamExperience})</p>
                                          <p>• 安全等级系数：{slaConfig.securityLevel} (×{slaConfig.securityLevel})</p>
                                          <p>• 支持方式系数：{slaConfig.supportMode} (×{slaConfig.supportMode})</p>
                                          <p>• 故障恢复时间系数：{slaConfig.faultRecoveryTime} (×{slaConfig.faultRecoveryTime})</p>
                                          <p>• 服务时间系数：{slaConfig.serviceTime} (×{SERVICE_TIME_FACTORS[slaConfig.serviceTime]})</p>
                                          <p>• 到场时间系数：{slaConfig.arrivalTime} (×{ARRIVAL_TIME_FACTORS[slaConfig.arrivalTime]})</p>
                                          <p>• 响应时间系数：{slaConfig.responseTime} (×{RESPONSE_TIME_FACTORS[slaConfig.responseTime]})</p>
                                          <p><strong>• SLA总系数：×{calculateSLATotalFactor(slaConfig).toFixed(2)}</strong></p>
                                        </div>
                                        <p><strong>3. 计算方式：</strong>价格 = ∑(单台设备价格 × 数量) × 地区系数 × SLA系数</p>
                                        <p><strong>4. 税率：</strong>按国家规定的13%增值税率计算</p>
                                      </div>
                                      <div className="mt-2 pt-2 border-t">
                                        <div className="text-xs text-slate-500">
                                          设备明细：
                                        </div>
                                        <div className="mt-1 space-y-1">
                                          {fullQuoteResult.deviceItems.map((item, idx) => {
                                            // 获取该地区的设备价格
                                            let regionPrice = 0;
                                            switch (region) {
                                              case '城区':
                                                regionPrice = item.cityPrice;
                                                break;
                                              case '市区县城郊区':
                                                regionPrice = item.urbanPrice;
                                                break;
                                              case '乡镇':
                                                regionPrice = item.townPrice;
                                                break;
                                              case '农村':
                                                regionPrice = item.ruralPrice;
                                                break;
                                            }
                                            
                                            return (
                                              <div key={idx} className="flex justify-between text-xs">
                                                <span>{item.quota.name} × {item.quantity}</span>
                                                <span className="font-medium">{formatCurrencyLocal(regionPrice * item.quantity)}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">报价汇总</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">设备数量</span>
                            <span className="font-medium">
                              {(fullQuoteResult?.totalDevices || selectedDevices.reduce((sum, d) => sum + d.quantity, 0))} 台
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">不含税金额</span>
                            <span className="font-medium">
                              {formatCurrencyLocal(fullQuoteResult?.subtotalAfterDiscount || quoteResult?.subtotal || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">税额 (13%)</span>
                            <span className="font-medium">
                              {formatCurrencyLocal(fullQuoteResult?.taxAmount || quoteResult?.taxAmount || 0)}
                            </span>
                          </div>
                          {fullQuoteResult && fullQuoteResult.bulkDiscountAmount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>批量优惠</span>
                              <span className="font-medium">-{formatCurrencyLocal(fullQuoteResult.bulkDiscountAmount)}</span>
                            </div>
                          )}
                          <div className="h-px bg-slate-200" />
                          <div className="flex justify-between">
                            <span className="font-semibold">含税总价</span>
                            <span className="text-xl font-bold text-blue-700">
                              {formatCurrencyLocal(fullQuoteResult?.finalTotal || quoteResult?.total || 0)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                          className="flex-1 bg-blue-700 hover:bg-blue-800"
                          onClick={handleSaveQuote}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          保存报价
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Printer className="h-4 w-4 mr-2" />
                          打印
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 border-purple-600 text-purple-700 hover:bg-purple-50"
                          onClick={handleExportQuote}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          导出Word
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 border-green-600 text-green-700 hover:bg-green-50"
                          onClick={handleExportExcel}
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          导出Excel
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* 设备定额库 */}
        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                维保设备定额库
              </CardTitle>
              <CardDescription>政企设备维保定额标准数据库</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                // 获取要显示的数据
                const displayData = useFullData 
                  ? FULL_DEVICE_QUOTAS 
                  : FULL_DEVICE_QUOTAS.filter(d => selectedCategories.includes(d.category));
                
                // 计算分页
                const totalPages = Math.ceil(displayData.length / ITEMS_PER_PAGE);
                const startIndex = (databasePage - 1) * ITEMS_PER_PAGE;
                const endIndex = startIndex + ITEMS_PER_PAGE;
                const currentPageData = displayData.slice(startIndex, endIndex);
                
                return (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16 text-center">序号</TableHead>
                          <TableHead>设备分类</TableHead>
                          <TableHead>设备名称</TableHead>
                          <TableHead>规格型号</TableHead>
                          <TableHead>维保分档</TableHead>
                          <TableHead>工程师等级</TableHead>
                          <TableHead className="text-right">城区报价</TableHead>
                          <TableHead className="text-right">市区县城郊区报价</TableHead>
                          <TableHead className="text-right">乡镇报价</TableHead>
                          <TableHead className="text-right">农村报价</TableHead>
                          <TableHead>核心维保内容</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {useFullData ? (
                          // 新版：使用完整设备数据
                          currentPageData.map((quota, index) => (
                            <TableRow key={quota.id}>
                              <TableCell className="text-center text-slate-500">
                                {startIndex + index + 1}
                              </TableCell>
                              <TableCell className="font-medium">{quota.category}</TableCell>
                              <TableCell>{quota.name}</TableCell>
                              <TableCell className="text-slate-500">{quota.model}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {quota.level}档 - {quota.levelName}
                                </Badge>
                              </TableCell>
                              <TableCell>{quota.engineerLevel}</TableCell>
                              <TableCell className="text-right font-medium text-blue-700">
                                {formatCurrencyLocal(quota.cityPrice)}
                              </TableCell>
                              <TableCell className="text-right font-medium text-cyan-700">
                                {formatCurrencyLocal(quota.urbanPrice)}
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-700">
                                {formatCurrencyLocal(quota.townPrice)}
                              </TableCell>
                              <TableCell className="text-right font-medium text-orange-700">
                                {formatCurrencyLocal(quota.ruralPrice)}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-slate-500 text-sm">
                                {quota.coreMaintenanceContent}
                              </TableCell>
                              <TableCell className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleAddFullDevice(quota)}
                                >
                                  <Plus className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingQuota(quota);
                                    setIsEditDialogOpen(true);
                                  }}
                                >
                                  <Settings className="h-4 w-4 text-slate-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          // 旧版：保持向后兼容
                          currentPageData.map((quota, index) => (
                            <TableRow key={quota.id}>
                              <TableCell className="text-center text-slate-500">
                                {startIndex + index + 1}
                              </TableCell>
                              <TableCell className="font-medium">{quota.category}</TableCell>
                              <TableCell>{quota.name}</TableCell>
                              <TableCell className="text-slate-500">{quota.model}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {quota.level}档 - {MAINTENANCE_LEVEL_CONFIG[quota.level].name}
                                </Badge>
                              </TableCell>
                              <TableCell>{quota.engineerLevel}</TableCell>
                              <TableCell className="text-right font-medium text-blue-700">
                                {formatCurrencyLocal(quota.cityPrice)}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-slate-500 text-sm">
                                {quota.coreMaintenanceContent}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleAddDevice(quota)}
                                >
                                  <Plus className="h-4 w-4 text-blue-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    
                    {/* 分页控制 */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="text-sm text-slate-500">
                          共 {displayData.length} 条，第 {databasePage} / {totalPages} 页
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDatabasePage(1)}
                            disabled={databasePage === 1}
                          >
                            首页
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDatabasePage(Math.max(1, databasePage - 1))}
                            disabled={databasePage === 1}
                          >
                            上一页
                          </Button>
                          
                          {/* 页码按钮 */}
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (databasePage <= 3) {
                                pageNum = i + 1;
                              } else if (databasePage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = databasePage - 2 + i;
                              }
                              
                              return (
                                <Button
                                  key={pageNum}
                                  variant={databasePage === pageNum ? 'default' : 'outline'}
                                  size="sm"
                                  className={databasePage === pageNum ? 'w-8 h-8 p-0 bg-blue-700' : 'w-8 h-8 p-0'}
                                  onClick={() => setDatabasePage(pageNum)}
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDatabasePage(Math.min(totalPages, databasePage + 1))}
                            disabled={databasePage === totalPages}
                          >
                            下一页
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDatabasePage(totalPages)}
                            disabled={databasePage === totalPages}
                          >
                            末页
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SLA参数配置 */}
        <TabsContent value="sla" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-600" />
                  SLA服务级别配置
                </CardTitle>
                <CardDescription>配置维保服务等级协议参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      运维团队经验
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '有经验', value: 1.2 },
                        { label: '类似经验', value: 1.0 },
                        { label: '无经验', value: 0.8 },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={slaConfig.teamExperience === option.value ? 'default' : 'outline'}
                          onClick={() => setSlaConfig({ ...slaConfig, teamExperience: option.value })}
                          className={slaConfig.teamExperience === option.value ? 'bg-blue-700' : ''}
                        >
                          {option.label}
                          <span className="ml-1 text-xs opacity-70">({option.value})</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      安全等级
                    </Label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { level: '第一级', value: 0.9 },
                        { level: '第二级', value: 0.95 },
                        { level: '第三级', value: 1.0 },
                        { level: '第四级', value: 1.05 },
                        { level: '第五级', value: 1.1 },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={slaConfig.securityLevel === option.value ? 'default' : 'outline'}
                          onClick={() => setSlaConfig({ ...slaConfig, securityLevel: option.value })}
                          className={slaConfig.securityLevel === option.value ? 'bg-blue-700' : ''}
                        >
                          {option.level}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      支持方式
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '非现场支持', value: 0.89 },
                        { label: '现场支持为主', value: 1.0 },
                        { label: '纯现场支持', value: 1.1 },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={slaConfig.supportMode === option.value ? 'default' : 'outline'}
                          onClick={() => setSlaConfig({ ...slaConfig, supportMode: option.value })}
                          className={slaConfig.supportMode === option.value ? 'bg-blue-700' : ''}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      故障恢复时间
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: '≤4小时', value: 1.2 },
                        { label: '≤24小时', value: 1.0 },
                        { label: '≤48小时', value: 0.9 },
                        { label: '≤72小时', value: 0.85 },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={slaConfig.faultRecoveryTime === option.value ? 'default' : 'outline'}
                          onClick={() => setSlaConfig({ ...slaConfig, faultRecoveryTime: option.value })}
                          className={slaConfig.faultRecoveryTime === option.value ? 'bg-blue-700' : ''}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>服务时间</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['5×8', '7×8', '7×24'] as ServiceTimeType[]).map((type) => (
                        <Button
                          key={type}
                          variant={slaConfig.serviceTime === type ? 'default' : 'outline'}
                          onClick={() => setSlaConfig({ ...slaConfig, serviceTime: type })}
                          className={slaConfig.serviceTime === type ? 'bg-blue-700' : ''}
                        >
                          {type}服务
                          <span className="ml-1 text-xs opacity-70">
                            (×{SERVICE_TIME_FACTORS[type]})
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>到场时间</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['2小时', '8小时'] as ArrivalTimeType[]).map((type) => (
                        <Button
                          key={type}
                          variant={slaConfig.arrivalTime === type ? 'default' : 'outline'}
                          onClick={() => setSlaConfig({ ...slaConfig, arrivalTime: type })}
                          className={slaConfig.arrivalTime === type ? 'bg-blue-700' : ''}
                        >
                          {type}
                          <span className="ml-1 text-xs opacity-70">
                            (×{ARRIVAL_TIME_FACTORS[type]})
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>响应时间</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['10分钟', '30分钟'] as ResponseTimeType[]).map((type) => (
                        <Button
                          key={type}
                          variant={slaConfig.responseTime === type ? 'default' : 'outline'}
                          onClick={() => setSlaConfig({ ...slaConfig, responseTime: type })}
                          className={slaConfig.responseTime === type ? 'bg-blue-700' : ''}
                        >
                          {type}
                          <span className="ml-1 text-xs opacity-70">
                            (×{RESPONSE_TIME_FACTORS[type]})
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t bg-slate-50">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <span className="text-sm text-slate-500">当前SLA总系数：</span>
                    <span className="ml-2 text-lg font-bold text-blue-700">
                      {(slaConfig.teamExperience * slaConfig.securityLevel * slaConfig.supportMode * 
                        slaConfig.faultRecoveryTime * ARRIVAL_TIME_FACTORS[slaConfig.arrivalTime] * RESPONSE_TIME_FACTORS[slaConfig.responseTime] * 
                        SERVICE_TIME_FACTORS[slaConfig.serviceTime]).toFixed(4)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSlaConfig(DEFAULT_SLA_CONFIG)}
                  >
                    重置默认
                  </Button>
                </div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  基础参数说明
                </CardTitle>
                <CardDescription>维保报价系统的核心参数配置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">维保分档说明</h4>
                    <div className="space-y-2">
                      {Object.entries(MAINTENANCE_LEVEL_CONFIG).map(([level, config]) => (
                        <div key={level} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <Badge variant="outline" className="shrink-0">
                            {level}档
                          </Badge>
                          <div>
                            <div className="font-medium">{config.name}</div>
                            <div className="text-sm text-slate-500">{config.description}</div>
                            <div className="text-xs text-slate-400 mt-1">
                              年故障数基准值: {config.baseFaultCount}次
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">工程师等级单价</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(ENGINEER_PRICES).map(([level, price]) => (
                        <div key={level} className="p-3 bg-slate-50 rounded-lg text-center">
                          <div className="font-medium">{level}</div>
                          <div className="text-lg font-bold text-blue-700">{formatCurrency(price)}</div>
                          <div className="text-xs text-slate-500">/天</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">成新率系数</h4>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.entries(DEPRECIATION_FACTORS).map(([level, factor]) => (
                        <div key={level} className="p-2 bg-slate-50 rounded-lg text-center">
                          <div className="font-medium text-sm">{level}</div>
                          <div className="text-lg font-bold text-orange-600">×{factor}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">地区系数</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(REGION_FACTORS).map(([region, factor]) => (
                        <div key={region} className="p-2 bg-slate-50 rounded-lg flex justify-between items-center">
                          <span className="font-medium text-sm">{region}</span>
                          <span className="text-lg font-bold text-blue-700">×{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 查勘问询 */}
        <TabsContent value="survey" className="space-y-6">
          <SurveyQuestionnaire
            initialAnswers={surveyAnswers}
            onSave={(answers) => {
              setSurveyAnswers(answers);
            }}
          />
        </TabsContent>

        {/* 增值服务 */}
        <TabsContent value="value-added" className="space-y-6">
          <ValueAddedServicesSelector />
        </TabsContent>
      </Tabs>

      {/* 编辑设备定额对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑设备定额</DialogTitle>
            <DialogDescription>
              修改设备定额库中的设备信息
            </DialogDescription>
          </DialogHeader>
          
          {editingQuota && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>设备分类</Label>
                  <Input 
                    value={editingQuota.category} 
                    onChange={(e) => setEditingQuota({...editingQuota, category: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>设备名称</Label>
                  <Input 
                    value={editingQuota.name} 
                    onChange={(e) => setEditingQuota({...editingQuota, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>规格型号</Label>
                  <Input 
                    value={editingQuota.model} 
                    onChange={(e) => setEditingQuota({...editingQuota, model: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>维保分档</Label>
                  <Select 
                    value={editingQuota.level} 
                    onValueChange={(value: any) => setEditingQuota({...editingQuota, level: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A档 - 简易型</SelectItem>
                      <SelectItem value="B">B档 - 基础型</SelectItem>
                      <SelectItem value="C">C档 - 中级型</SelectItem>
                      <SelectItem value="D">D档 - 高级型</SelectItem>
                      <SelectItem value="E">E档 - 专家型</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>工程师等级</Label>
                  <Select 
                    value={editingQuota.engineerLevel} 
                    onValueChange={(value: any) => setEditingQuota({...editingQuota, engineerLevel: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="初级">初级</SelectItem>
                      <SelectItem value="中级">中级</SelectItem>
                      <SelectItem value="高级">高级</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>城区报价（元）</Label>
                  <Input 
                    type="number"
                    value={editingQuota.cityPrice} 
                    onChange={(e) => setEditingQuota({...editingQuota, cityPrice: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>市区县城郊区报价（元）</Label>
                  <Input 
                    type="number"
                    value={editingQuota.urbanPrice} 
                    onChange={(e) => setEditingQuota({...editingQuota, urbanPrice: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>乡镇报价（元）</Label>
                  <Input 
                    type="number"
                    value={editingQuota.townPrice} 
                    onChange={(e) => setEditingQuota({...editingQuota, townPrice: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>农村报价（元）</Label>
                  <Input 
                    type="number"
                    value={editingQuota.ruralPrice} 
                    onChange={(e) => setEditingQuota({...editingQuota, ruralPrice: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>核心维保内容</Label>
                <Input 
                  value={editingQuota.coreMaintenanceContent} 
                  onChange={(e) => setEditingQuota({...editingQuota, coreMaintenanceContent: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>巡检内容</Label>
                <Input 
                  value={editingQuota.inspectionContent || ''} 
                  onChange={(e) => setEditingQuota({...editingQuota, inspectionContent: e.target.value})}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button 
              className="bg-blue-700 hover:bg-blue-800"
              onClick={() => {
                if (editingQuota) {
                  const updated = updateDeviceQuota(editingQuota.id, editingQuota);
                  if (updated) {
                    alert('设备定额更新成功！');
                    setIsEditDialogOpen(false);
                  } else {
                    alert('更新失败：未找到设备');
                  }
                }
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SLA配置对话框 */}
      <Dialog open={isSlaDialogOpen} onOpenChange={setIsSlaDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配置SLA参数</DialogTitle>
            <DialogDescription>
              {slaConfigDevice && `配置设备"${slaConfigDevice.quota.name}"的SLA参数`}
            </DialogDescription>
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                当前显示的是默认系数，您可以根据实际需求调整
              </p>
            </div>
          </DialogHeader>
          
          {slaConfigDevice && (
            <div className="space-y-6">
              {/* 运维团队经验 */}
              <div className="space-y-2">
                <Label>运维团队经验</Label>
                <Select 
                  value={slaConfigDevice.slaConfig?.teamExperience || '有'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          teamExperience: value as '有' | '类似' | '无',
                        }
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="有">
                      <div className="flex justify-between w-full">
                        <span>有</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.2</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="类似">
                      <div className="flex justify-between w-full">
                        <span>类似</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.0</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="无">
                      <div className="flex justify-between w-full">
                        <span>无</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×0.8</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 安全等级 */}
              <div className="space-y-2">
                <Label>安全等级</Label>
                <Select 
                  value={slaConfigDevice.slaConfig?.securityLevel || '二级'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          securityLevel: value as '一级' | '二级' | '三级' | '四级' | '五级',
                        }
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="一级">
                      <div className="flex justify-between w-full">
                        <span>一级</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×0.9</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="二级">
                      <div className="flex justify-between w-full">
                        <span>二级</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×0.95</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="三级">
                      <div className="flex justify-between w-full">
                        <span>三级</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.0</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="四级">
                      <div className="flex justify-between w-full">
                        <span>四级</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.05</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="五级">
                      <div className="flex justify-between w-full">
                        <span>五级</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.1</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 支持方式 */}
              <div className="space-y-2">
                <Label>支持方式</Label>
                <Select 
                  value={slaConfigDevice.slaConfig?.supportMode || '现场支持为主'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          supportMode: value as '非现场支持为主' | '现场支持为主' | '纯现场支持',
                        }
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="非现场支持为主">
                      <div className="flex justify-between w-full">
                        <span>非现场支持为主</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×0.89</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="现场支持为主">
                      <div className="flex justify-between w-full">
                        <span>现场支持为主</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.0</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="纯现场支持">
                      <div className="flex justify-between w-full">
                        <span>纯现场支持</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.1</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 故障恢复时间 */}
              <div className="space-y-2">
                <Label>故障恢复时间</Label>
                <Select 
                  value={slaConfigDevice.slaConfig?.faultRecoveryTime || '≤24h'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          faultRecoveryTime: value as '≤4h' | '≤24h' | '≤48h' | '≤72h',
                        }
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="≤4h">
                      <div className="flex justify-between w-full">
                        <span>≤4h</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.2</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="≤24h">
                      <div className="flex justify-between w-full">
                        <span>≤24h</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.0</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="≤48h">
                      <div className="flex justify-between w-full">
                        <span>≤48h</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×0.9</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="≤72h">
                      <div className="flex justify-between w-full">
                        <span>≤72h</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×0.85</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 到场时间 */}
              <div className="space-y-2">
                <Label>到场时间</Label>
                <Select 
                  value={slaConfigDevice.slaConfig?.arrivalTime || '8小时'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          arrivalTime: value as '2小时' | '8小时',
                        }
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2小时">
                      <div className="flex justify-between w-full">
                        <span>2小时</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.2</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="8小时">
                      <div className="flex justify-between w-full">
                        <span>8小时</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.0</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 响应时间 */}
              <div className="space-y-2">
                <Label>响应时间</Label>
                <Select 
                  value={slaConfigDevice.slaConfig?.responseTime || '30分钟'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          responseTime: value as '10分钟' | '30分钟',
                        }
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10分钟">
                      <div className="flex justify-between w-full">
                        <span>10分钟</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.1</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="30分钟">
                      <div className="flex justify-between w-full">
                        <span>30分钟</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.0</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 服务时间 */}
              <div className="space-y-2">
                <Label>服务时间</Label>
                <Select 
                  value={slaConfigDevice.slaConfig?.serviceTime || '5×8'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          serviceTime: value as '5×8' | '7×8' | '7×24',
                        }
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5×8">
                      <div className="flex justify-between w-full">
                        <span>5×8</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.0</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="7×8">
                      <div className="flex justify-between w-full">
                        <span>7×8</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.2</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="7×24">
                      <div className="flex justify-between w-full">
                        <span>7×24</span>
                        <Badge className="ml-2 bg-blue-100 text-blue-700">×1.6</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsSlaDialogOpen(false);
                setSlaConfigDevice(null);
                setIsNewSlaDevice(false);
              }}
            >
              取消
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                if (slaConfigDevice) {
                  setSlaConfigDevice({
                    ...slaConfigDevice,
                    slaConfig: {
                      teamExperience: '有',
                      securityLevel: '二级',
                      supportMode: '现场支持为主',
                      faultRecoveryTime: '≤24h',
                      arrivalTime: '8小时',
                      responseTime: '30分钟',
                      serviceTime: '5×8',
                    },
                  });
                }
              }}
            >
              重置为默认
            </Button>
            <Button 
              className="bg-blue-700 hover:bg-blue-800"
              onClick={() => {
                if (slaConfigDevice) {
                  if (isNewSlaDevice) {
                    // 新添加设备
                    setSelectedDevices([...selectedDevices, slaConfigDevice]);
                  } else {
                    // 更新现有设备
                    const deviceIndex = selectedDevices.findIndex(d => d.quota.id === slaConfigDevice.quota.id);
                    if (deviceIndex !== -1) {
                      const newSelectedDevices = [...selectedDevices];
                      newSelectedDevices[deviceIndex] = slaConfigDevice;
                      setSelectedDevices(newSelectedDevices);
                    }
                  }
                  setIsSlaDialogOpen(false);
                  setSlaConfigDevice(null);
                  setIsNewSlaDevice(false);
                }
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
