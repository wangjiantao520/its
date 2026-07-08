/* eslint-disable @typescript-eslint/no-explicit-any --
 * 该文件为 4000+ 行的核心维保报价页面，含大量历史业务代码
 * (item as any).field 模式用于访问联合类型中的可选字段
 * 完整重构已列入 P2 重构计划
 */
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
  Sparkles,
  Loader2,
  History,
  Clipboard,
  Link2,
  Share2,
  Send,
  Filter,
  CheckSquare,
  Square,
  Users,
  FileDown,
  FileUp,
  Copy,
  Check,
  ChevronRight,
  MoreHorizontal,
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
  getRecommendedDepreciationGrade,
  getFailureRate,
  formatCurrency,
  formatCurrencyDisplay,
  type FullMaintenanceQuoteResult,
  type FullDeviceQuoteItemResult,
  type FullQuoteResult,
  type DeviceQuoteItem,
  type CostDetailItem,
  type Region,
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
import { parseQuoteRequirement, parseQuoteWithHistory, AI_QUOTE_EXAMPLES, type AiQuoteDraft, type RecognitionStatus, type ChatMessage, formatPrice } from '@/lib/ai-quote-parser';
import { AiChatPanel } from '@/components/quotes/ai-chat-panel';
import {
  generateMaintenanceQuoteHTML,
  downloadAsWord,
  convertToChineseCurrency,
  type MaintenanceQuoteExportData,
} from '@/lib/export-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function MaintenanceQuotePage() {
  // 动态设备数据（从数据库加载）
  const [dbDeviceQuotas, setDbDeviceQuotas] = useState<any[]>([]);
  const [dbDataLoading, setDbDataLoading] = useState(true);
  
  // AI辅助报价状态
  const [aiRequirementText, setAiRequirementText] = useState('');
  const [aiRecognitionStatus, setAiRecognitionStatus] = useState<RecognitionStatus>('idle');
  const [aiDraft, setAiDraft] = useState<AiQuoteDraft | null>(null);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [showAiCompletionDialog, setShowAiCompletionDialog] = useState(false);
  const [completionDraft, setCompletionDraft] = useState<AiQuoteDraft | null>(null);
  const [showAiChat, setShowAiChat] = useState(false);  // 新增：AI对话面板
  const [aiChatHistory, setAiChatHistory] = useState<ChatMessage[]>([]);  // 新增：对话历史
  const [uploadedFileContent, setUploadedFileContent] = useState<string>('');  // 新增：上传文件内容
  const [uploadedFileName, setUploadedFileName] = useState<string>('');  // 新增：上传文件名

  // 价格设置功能
  const [showPriceSettings, setShowPriceSettings] = useState(false);
  const [priceSettings, setPriceSettings] = useState<Record<string, number>>({});
  const [adminPassword, setAdminPassword] = useState('');
  const [saveType, setSaveType] = useState<'temp' | 'permanent'>('temp');

  // AI辅助报价处理函数
  const handleAiParse = async () => {
    if (!aiRequirementText.trim()) {
      return;
    }
    setAiRecognitionStatus('analyzing');
    try {
      const draft = await parseQuoteRequirement(aiRequirementText);
      setAiDraft(draft);
      setCompletionDraft(JSON.parse(JSON.stringify(draft)));
      setAiRecognitionStatus(draft.missingFields.length > 0 && draft.devices.length === 0 ? 'needs_info' : 'success');
      setShowAiCompletionDialog(true);
    } catch (error) {
      console.error('AI解析失败:', error);
      setAiRecognitionStatus('failed');
    }
  };

  const handleClearAi = () => {
    setAiRequirementText('');
    setAiRecognitionStatus('idle');
    setAiDraft(null);
    setShowAiPreview(false);
    setUploadedFileContent('');
    setUploadedFileName('');
  };

  const handleClearFile = () => {
    setUploadedFileName('');
    setUploadedFileContent('');
    setAiRequirementText('');
    setAiRecognitionStatus('idle');
    // 清空文件输入框
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // 文件上传处理函数
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setAiRecognitionStatus('recognizing');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        setUploadedFileContent(content);
        
        // 将文件内容作为需求文本进行AI识别
        const fullText = `从文件 ${file.name} 中提取的设备清单：\n\n${content}`;
        setAiRequirementText(fullText);
        
        // 自动触发AI识别
        try {
          const draft = await parseQuoteRequirement(fullText);
          setAiDraft(draft);
          setCompletionDraft(JSON.parse(JSON.stringify(draft)));
          setAiRecognitionStatus(draft.missingFields.length > 0 && draft.devices.length === 0 ? 'needs_info' : 'success');
          setShowAiCompletionDialog(true);
        } catch (error) {
          console.error('AI解析失败:', error);
          setAiRecognitionStatus('failed');
        }
      };
      
      // 根据文件类型选择读取方式
      if (file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.md')) {
        reader.readAsText(file);
      } else {
        setAiRecognitionStatus('failed');
        alert('暂不支持该文件格式，请上传 .txt, .csv, 或 .md 文件');
      }
    } catch (error) {
      console.error('文件读取失败:', error);
      setAiRecognitionStatus('failed');
    }
  };

  const handleUseExample = (example: string) => {
    setAiRequirementText(example);
  };
  
  // 价格设置处理函数
  const handleOpenPriceSettings = () => {
    // 初始化价格设置
    const initialPrices: Record<string, number> = {};
    if (useFullData && fullQuoteResult && fullQuoteResult.deviceItems.length > 0) {
      // 初始化所有设备价格
      fullQuoteResult.deviceItems.forEach((item, index) => {
        const key = `device_${index}`;
        // 根据当前地区获取对应的价格
        let currentPrice = 0;
        switch (region) {
          case '城区':
            currentPrice = item.cityPrice;
            break;
          case '市区县城郊区':
            currentPrice = item.urbanPrice;
            break;
          case '乡镇':
            currentPrice = item.townPrice;
            break;
          case '农村':
            currentPrice = item.ruralPrice;
            break;
          default:
            currentPrice = item.cityPrice;
        }
        initialPrices[key] = currentPrice;
      });
      
      // 初始化费用项目（使用第一个设备的值作为默认值）
      const firstItem = fullQuoteResult.deviceItems[0];
      initialPrices.inspectionFee = firstItem.inspectionFee;
      initialPrices.onSiteFee = firstItem.onSiteFee;
      initialPrices.faultHandlingFee = firstItem.faultHandlingFee;
      initialPrices.toolAmortization = firstItem.toolAmortization;
      initialPrices.consumableFee = firstItem.consumableFee;
      initialPrices.sparePartReserve = firstItem.sparePartReserve;
      initialPrices.inWarrantyFactor = 0.5; // 默认在保系数0.5
    }
    setPriceSettings(initialPrices);
    setShowPriceSettings(true);
  };
  
  const handleSavePriceSettings = () => {
    if (saveType === 'permanent') {
      // 永久保存需要验证管理员密码
      if (adminPassword !== 'ecloud10086') {
        alert('管理员密码错误！');
        return;
      }
    }
    
    // 应用价格修改到报价结果
    if (useFullData && fullQuoteResult) {
      const updatedResult = { ...fullQuoteResult };
      
      // 检查是否修改了费用项目
      const hasFeeChanges = priceSettings.inspectionFee !== undefined || 
                           priceSettings.onSiteFee !== undefined ||
                           priceSettings.faultHandlingFee !== undefined ||
                           priceSettings.toolAmortization !== undefined ||
                           priceSettings.consumableFee !== undefined ||
                           priceSettings.sparePartReserve !== undefined;
      
      // 更新设备价格和费用项目
      updatedResult.deviceItems = updatedResult.deviceItems.map((item, index) => {
        const updatedItem = { ...item };
        const key = `device_${index}`;
        
        // 更新设备单价（如果有自定义）
        if (priceSettings[key] !== undefined) {
          const newPrice = priceSettings[key];
          updatedItem.cityPrice = newPrice;
          updatedItem.urbanPrice = newPrice;
          updatedItem.townPrice = newPrice;
          updatedItem.ruralPrice = newPrice;
        }
        
        // 更新费用项目
        if (priceSettings.inspectionFee !== undefined) {
          updatedItem.inspectionFee = priceSettings.inspectionFee;
        }
        if (priceSettings.onSiteFee !== undefined) {
          updatedItem.onSiteFee = priceSettings.onSiteFee;
        }
        if (priceSettings.faultHandlingFee !== undefined) {
          updatedItem.faultHandlingFee = priceSettings.faultHandlingFee;
        }
        if (priceSettings.toolAmortization !== undefined) {
          updatedItem.toolAmortization = priceSettings.toolAmortization;
        }
        if (priceSettings.consumableFee !== undefined) {
          updatedItem.consumableFee = priceSettings.consumableFee;
        }
        if (priceSettings.sparePartReserve !== undefined) {
          updatedItem.sparePartReserve = priceSettings.sparePartReserve;
        }
        
        // 如果修改了费用项目，重新计算单价
        if (hasFeeChanges && priceSettings[key] === undefined) {
          // 重新计算基础价格：巡检费 + 上门费 + 故障处理费 + 工具摊销 + 耗材费
          // 如果需要备件，再加备件准备金
          let basePrice = updatedItem.inspectionFee + 
                         updatedItem.onSiteFee + 
                         updatedItem.faultHandlingFee + 
                         updatedItem.toolAmortization + 
                         updatedItem.consumableFee;
          
          if (updatedItem.needSparePart) {
            basePrice += updatedItem.sparePartReserve;
          }
          
          // 应用SLA系数、折旧系数、在保系数
          const newCityPrice = basePrice * updatedItem.slaTotalFactor * 
                              (() => {
                                // 获取折旧系数，这里简化处理
                                const grade = updatedItem.depreciationGrade;
                                if (grade === 1) return 1.0;
                                if (grade === 2) return 0.9;
                                if (grade === 3) return 0.75;
                                if (grade === 4) return 0.6;
                                if (grade === 5) return 0.45;
                                return 0.6; // 默认
                              })() * 
                              (updatedItem.inWarranty ? (priceSettings.inWarrantyFactor ?? 0.5) : 1.0);
          
          updatedItem.cityPrice = newCityPrice;
          // 其他地区价格按城区价格计算
          const REGION_FACTORS = {
            '城区': 1,
            '市区县城郊区': 1.1,
            '乡镇': 1.3,
            '农村': 1.5
          };
          updatedItem.urbanPrice = newCityPrice * REGION_FACTORS['市区县城郊区'];
          updatedItem.townPrice = newCityPrice * REGION_FACTORS['乡镇'];
          updatedItem.ruralPrice = newCityPrice * REGION_FACTORS['农村'];
        }
        
        // 重新计算小计
        updatedItem.totalBeforeDiscount = updatedItem.cityPrice * updatedItem.quantity;
        const bulkDiscountFactor = updatedItem.quantity >= 10 ? 0.95 : 1.0;
        const yearDiscountFactor = updatedItem.contractYears >= 3 ? 0.9 : 
                                   updatedItem.contractYears >= 2 ? 0.95 : 1.0;
        updatedItem.totalAfterDiscount = updatedItem.totalBeforeDiscount * 
                                         bulkDiscountFactor * yearDiscountFactor * 
                                         updatedItem.contractYears;
        
        return updatedItem;
      });
      
      // 重新计算汇总数据
      const taxRate = 0.13;
      const FULL_REGION_FACTORS = {
        '城区': 1,
        '市区县城郊区': 1.1,
        '乡镇': 1.3,
        '农村': 1.5
      };
      
      updatedResult.totalDevices = updatedResult.deviceItems.reduce((sum, item) => sum + item.quantity, 0);
      updatedResult.subtotalBeforeDiscount = updatedResult.deviceItems.reduce((sum, item) => sum + item.totalBeforeDiscount, 0);
      updatedResult.subtotalAfterDiscount = updatedResult.deviceItems.reduce((sum, item) => sum + item.totalAfterDiscount, 0);
      updatedResult.bulkDiscountAmount = updatedResult.subtotalBeforeDiscount - updatedResult.subtotalAfterDiscount;
      updatedResult.taxRate = taxRate;
      updatedResult.taxAmount = updatedResult.subtotalAfterDiscount * taxRate;
      updatedResult.finalTotal = updatedResult.subtotalAfterDiscount * (1 + taxRate);
      
      // 重新计算分地区报价
      const calculateRegionTotal = (regionType: any) => {
        const subtotal = updatedResult.deviceItems.reduce((sum, item) => {
          // 根据地区获取对应的单价
          let regionPrice = 0;
          switch (regionType) {
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
            default:
              regionPrice = item.cityPrice;
          }
          return sum + regionPrice * item.quantity * (item.bulkDiscountFactor || 1.0) * 
                       (item.yearDiscountFactor || 1.0) * item.contractYears;
        }, 0);
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;
        return { subtotal, taxAmount, total };
      };
      
      updatedResult.totalByRegion = {
        '城区': calculateRegionTotal('城区'),
        '市区县城郊区': calculateRegionTotal('市区县城郊区'),
        '乡镇': calculateRegionTotal('乡镇'),
        '农村': calculateRegionTotal('农村'),
      };
      
      setFullQuoteResult(updatedResult);
    }
    
    if (saveType === 'permanent') {
      alert('价格已永久保存！');
    } else {
      alert('价格已暂时保存！');
    }
    setShowPriceSettings(false);
    setAdminPassword('');
  };

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
  const [quoteDate, setQuoteDate] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [contractYears, setContractYears] = useState<string>('1');
  const [needSpareParts, setNeedSpareParts] = useState<boolean>(false);
  const [region, setRegion] = useState<RegionType>('城区');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [engineerLevel, setEngineerLevel] = useState<EngineerLevel>('中级');

  // 使用 useEffect 初始化日期，避免 hydration mismatch
  useEffect(() => {
    setQuoteDate(new Date().toISOString().split('T')[0]);
  }, []);

  // 从数据库加载设备定额数据
  useEffect(() => {
    const loadDeviceData = async () => {
      try {
        setDbDataLoading(true);
        const response = await fetch('/api/device-params?type=device_quotas');
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          // 将数据库数据转换为 FullDeviceQuota 格式
          const convertedData = result.data.map((item: any) => ({
            id: item.id || item.item_id,
            category: item.category || '',
            name: item.name || '',
            brand: item.brand || '',
            model: item.model || '',
            specification: item.specification || '',
            maintenanceTier: item.maintenance_tier || 'C档',
            annualFaultCount: item.annual_fault_count || 0,
            aGearFaultCount: item.a_gear_fault_count || 0,
            bGearFaultCount: item.b_gear_fault_count || 0,
            cGearFaultCount: item.c_gear_fault_count || 0,
            dGearFaultCount: item.d_gear_fault_count || 0,
            eGearFaultCount: item.e_gear_fault_count || 0,
            faultProcessingDays: item.fault_processing_days || 0,
            inspectionDays: item.inspection_days || 0,
            onSiteCount: item.on_site_count || 0,
            // 费用字段映射 - 同时支持计算函数需要的字段名
            inspectionFee: item.inspection_fee || item.inspection_labor_fee || 0,
            inspectionLaborFee: item.inspection_fee || item.inspection_labor_fee || 0,
            arrivalFee: item.arrival_fee || 0,
            onSiteFee: item.on_site_fee || 0,
            onSiteFeeAnnual: item.on_site_fee || item.visit_service_fee || 0,
            visitServiceFee: item.visit_service_fee || 0,
            trafficFee: item.traffic_fee || 0,
            faultHandlingFee: item.fault_handling_fee || 0,
            faultHandlingFeeTotal: item.fault_handling_fee || 0,
            toolAmortization: item.tool_amortization || 0,
            consumableFee: item.consumable_fee || 0,
            sparePartReserve: item.spare_part_reserve || 0,
            sparePartFee: item.spare_part_fee || 0,
            year1TotalPrice: item.year1_total_price || 0,
            year2TotalPrice: item.year2_total_price || 0,
            year3TotalPrice: item.year3_total_price || 0,
            cityPrice: item.city_price || 0,
            urbanPrice: item.urban_price || 0,
            townPrice: item.town_price || 0,
            ruralPrice: item.rural_price || 0,
          }));
          setDbDeviceQuotas(convertedData);
        }
      } catch (error) {
        console.error('加载设备数据失败:', error);
      } finally {
        setDbDataLoading(false);
      }
    };
    loadDeviceData();
  }, []);
  
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

  // 从动态数据获取设备分类
  const getDynamicDeviceCategories = () => {
    if (dbDeviceQuotas.length === 0) return getDeviceCategories();
    const categories = [...new Set(dbDeviceQuotas.map((d: any) => d.category).filter(Boolean))];
    return categories;
  };

  // 设备选择和数量（支持新老两种数据结构）
  type DeviceSLAConfig = {
    teamExperience: '有' | '类似' | '无';
    securityLevel: '一级' | '二级' | '三级' | '四级' | '五级';
    supportMode: '非现场支持为主' | '现场支持为主' | '纯现场支持';
    faultRecoveryTime: '≤4h' | '≤24h' | '≤48h' | '≤72h';
    arrivalTime: '2小时内' | '8小时内' | '4小时' | '24小时';
    responseTime: '10分钟内' | '30分钟内' | '1小时内' | '15分钟内';
    serviceTime: '5x8' | '7x8' | '7x24';
  };
  
  type SelectedDevice = {
    quota: DeviceQuota | FullDeviceQuota;
    quantity: number;
    useYears: number;
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

  // ========== 新增功能状态 ==========
  // 历史报价复用
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyQuotes, setHistoryQuotes] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 批量操作
  const [batchSelected, setBatchSelected] = useState<number[]>([]);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState<string>('');
  const [batchYears, setBatchYears] = useState<string>('1');

  // 客户选择器
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  // 分享链接
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  // 版本保存
  const [showSaveVersionDialog, setShowSaveVersionDialog] = useState(false);
  const [versionName, setVersionName] = useState('');

  // 提交审核
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewComment, setReviewComment] = useState('');

  // 专业报表导出
  const [showProfessionalExportDialog, setShowProfessionalExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'standard' | 'detailed' | 'summary'>('standard');

  // 选中的设备行（批量操作）
  const toggleDeviceSelection = (index: number) => {
    setBatchSelected(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const selectAllDevices = () => {
    setBatchSelected(selectedDevices.map((_, i) => i));
  };

  const clearSelection = () => {
    setBatchSelected([]);
  };

  // 历史报价复用
  const handleOpenHistoryDialog = async () => {
    setShowHistoryDialog(true);
    setHistoryLoading(true);
    // 模拟历史报价数据
    setHistoryQuotes([
      { id: 1, quoteNumber: 'WB20250601001', clientName: '宁德市政府办公室', totalAmount: 125000, createdAt: '2025-06-01', status: '草稿' },
      { id: 2, quoteNumber: 'WB20250528001', clientName: '福安市人民医院', totalAmount: 89000, createdAt: '2025-05-28', status: '已提交' },
      { id: 3, quoteNumber: 'WB20250515002', clientName: '蕉城区教育局', totalAmount: 156000, createdAt: '2025-05-15', status: '已确认' },
      { id: 4, quoteNumber: 'WB20250510003', clientName: '福鼎市人民法院', totalAmount: 78000, createdAt: '2025-05-10', status: '已签约' },
      { id: 5, quoteNumber: 'WB20250505004', clientName: '霞浦县公安局', totalAmount: 210000, createdAt: '2025-05-05', status: '草稿' },
    ]);
    setHistoryLoading(false);
  };

  const handleSelectHistoryQuote = (quote: any) => {
    // 应用历史报价的设备列表
    alert(`已将历史报价 ${quote.quoteNumber} 的设备列表应用到当前报价`);
    setShowHistoryDialog(false);
  };

  // 批量编辑
  const handleBatchEdit = () => {
    if (batchSelected.length === 0) {
      alert('请先选择要编辑的设备');
      return;
    }
    setShowBatchDialog(true);
  };

  const applyBatchEdit = () => {
    const newDevices = [...selectedDevices];
    batchSelected.forEach(index => {
      if (batchQuantity) {
        newDevices[index] = { ...newDevices[index], quantity: parseInt(batchQuantity) || 1 };
      }
      if (batchYears) {
        newDevices[index] = { ...newDevices[index], contractYears: parseInt(batchYears) || 1 };
      }
    });
    setSelectedDevices(newDevices);
    setShowBatchDialog(false);
    setBatchSelected([]);
    handleCalculate();
  };

  // 分享链接
  const handleGenerateShareLink = () => {
    const timestamp = Date.now();
    const link = `${window.location.origin}/quote-share/${timestamp}`;
    setShareLink(link);
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) {
      handleGenerateShareLink();
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    } catch {
      alert('复制失败，请手动复制');
    }
  };

  // 打开分享对话框
  const handleOpenShareDialog = () => {
    setShareDialogOpen(true);
    if (!shareLink) {
      handleGenerateShareLink();
    }
  };

  // 保存新版本
  const handleSaveAsNewVersion = () => {
    if (!versionName.trim()) {
      alert('请输入版本名称');
      return;
    }
    alert(`已保存为新版本：${versionName}`);
    setShowSaveVersionDialog(false);
    setVersionName('');
  };

  // 提交审核
  const handleSubmitForReview = () => {
    if (!reviewComment.trim()) {
      alert('请填写审核意见');
      return;
    }
    alert(`已提交审核，意见：${reviewComment}`);
    setShowReviewDialog(false);
    setReviewComment('');
  };

  // 专业报表导出
  const handleProfessionalExport = (format: 'standard' | 'detailed' | 'summary') => {
    setExportFormat(format);
    alert(`正在导出 ${format === 'standard' ? '标准格式' : format === 'detailed' ? '详细格式' : '汇总格式'} 报表...`);
    setShowProfessionalExportDialog(false);
  };

  // 客户端选择
  const handleSelectClient = (client: any) => {
    setCustomerName(client.name);
    setClientName(client.name);
    setClientSelectorOpen(false);
  };

  const handleOpenClientSelector = () => {
    setClientSelectorOpen(true);
    setClients([
      { id: 1, name: '宁德市政府办公室', region: '蕉城' },
      { id: 2, name: '福安市人民医院', region: '福安' },
      { id: 3, name: '蕉城区教育局', region: '蕉城' },
      { id: 4, name: '福鼎市人民法院', region: '福鼎' },
      { id: 5, name: '霞浦县公安局', region: '霞浦' },
    ]);
  };

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
        useYears: 1,
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
          arrivalTime: '8小时内',
          responseTime: '30分钟内',
          serviceTime: '5x8',
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
        useYears: 1,
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
          arrivalTime: '8小时内',
          responseTime: '30分钟内',
          serviceTime: '5x8',
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
    newDevices[index] = {
      ...newDevices[index],
      inWarranty
    };
    setSelectedDevices(newDevices);
  };
  
  // 更新是否需要备件
  const handleUpdateNeedSparePart = (index: number, needSparePart: boolean) => {
    const newDevices = [...selectedDevices];
    // 创建新的对象以确保React能检测到变化
    newDevices[index] = {
      ...newDevices[index],
      needSparePart
    };
    setSelectedDevices(newDevices);
  };
  
  // 更新合同年限
  const handleUpdateContractYears = (index: number, years: number) => {
    const newDevices = [...selectedDevices];
    newDevices[index] = {
      ...newDevices[index],
      contractYears: years
    };
    setSelectedDevices(newDevices);
  };

  // 更新设备使用年限
  const handleUpdateUseYears = (index: number, useYears: number) => {
    const newDevices = [...selectedDevices];
    const safeUseYears = useYears || 1;
    // 根据使用年限自动推荐成新率
    const recommendedGrade = getRecommendedDepreciationGrade(safeUseYears);
    newDevices[index] = {
      ...newDevices[index],
      useYears: safeUseYears,
      depreciationGrade: recommendedGrade,
      depreciationLevel: recommendedGrade
    };
    setSelectedDevices(newDevices);
  };

  // 更新设备分档
  const handleUpdateDeviceGrade = (index: number, grade: string) => {
    const newDevices = [...selectedDevices];
    newDevices[index] = {
      ...newDevices[index],
      deviceGrade: grade
    };
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
        needSparePart: needSpareParts, // 使用全局的备件选项
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

  // 监听合同年限、设备、备件选项变化，自动重新计算报价
  useEffect(() => {
    if (selectedDevices.length > 0 && (quoteResult || fullQuoteResult)) {
      handleCalculate();
    }
  }, [contractYears, selectedDevices, needSpareParts]);

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
          {/* AI对话模式切换 */}
          <div className="flex justify-end gap-2">
            <Button
              variant={showAiChat ? "outline" : "default"}
              size="sm"
              onClick={() => setShowAiChat(false)}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              快速识别
            </Button>
            <Button
              variant={showAiChat ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAiChat(true)}
              className={showAiChat ? "bg-blue-600" : ""}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI对话
            </Button>
          </div>

          {/* AI对话模式 */}
          {showAiChat ? (
            <AiChatPanel
              onApply={(draft) => {
                setAiDraft(draft);
                setCompletionDraft(draft);
                setShowAiChat(false);
                // 应用到表单
                if (draft.region) {
                  const regionMap: Record<string, typeof region> = {
                    '城区': '城区',
                    '市区县城郊区': '市区县城郊区',
                    '乡镇': '乡镇',
                    '农村': '农村',
                  };
                  if (regionMap[draft.region]) {
                    setRegion(regionMap[draft.region]);
                  }
                }
                if (draft.contractYears) {
                  setContractYears(String(draft.contractYears));
                }
                // TODO: 应用更多字段
              }}
              onClose={() => setShowAiChat(false)}
            />
          ) : (
          /* AI快速识别模式 */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                AI 快速识别
              </CardTitle>
              <CardDescription>用自然语言描述您的需求或导入设备清单文件，AI 将自动识别参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 文件上传区域 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">导入设备清单文件</Label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FileUp className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600 mb-1">点击或拖拽文件到此处</p>
                    <p className="text-xs text-slate-400">支持 Excel (.xlsx, .xls)、CSV (.csv)、文本文件 (.txt)</p>
                  </label>
                </div>
                {uploadedFileName && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">{uploadedFileName}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClearFile}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* 文本输入区域 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">或直接描述需求</Label>
                <textarea
                  placeholder="请描述项目情况，例如：某乡镇单位有 20 台使用 3 年的台式电脑、2 台使用 5 年的电动装订机，需要一年维保，每季度巡检一次，故障后 8 小时内到场。"
                  value={aiRequirementText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAiRequirementText(e.target.value)}
                  rows={4}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleAiParse} disabled={(!aiRequirementText.trim() && !uploadedFileContent) || aiRecognitionStatus === 'analyzing'}>
                  {aiRecognitionStatus === 'analyzing' ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 识别中...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> 智能识别{uploadedFileContent ? '文件' : '需求'}</>
                  )}
                </Button>
                <Button variant="secondary" onClick={handleClearAi}>
                  清空
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-slate-500">示例需求：</span>
                {AI_QUOTE_EXAMPLES.map((example, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUseExample(example)}
                    className="text-xs"
                  >
                    {idx + 1}
                  </Button>
                ))}
              </div>

              {/* AI识别结果预览 */}
              {showAiPreview && aiDraft && (
                <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">AI 识别结果预览</h4>
                    <Badge variant={aiRecognitionStatus === 'success' ? 'default' : 'destructive'}>
                      {aiRecognitionStatus === 'success' ? '识别成功' : aiRecognitionStatus === 'needs_info' ? '需要补充信息' : '识别失败'}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    {aiDraft.region && (
                      <div><span className="text-slate-500">服务地区：</span>{aiDraft.region}</div>
                    )}
                    {aiDraft.contractYears && (
                      <div><span className="text-slate-500">合同年限：</span>{aiDraft.contractYears}年</div>
                    )}
                    {aiDraft.annualInspectionCount && (
                      <div><span className="text-slate-500">年度巡检：</span>{aiDraft.annualInspectionCount}次/年</div>
                    )}
                    {aiDraft.arrivalTime && (
                      <div><span className="text-slate-500">到场时间：</span>{aiDraft.arrivalTime}</div>
                    )}
                    {aiDraft.devices.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-slate-500">识别到的设备：</span>
                        <ul className="list-disc list-inside">
                          {aiDraft.devices.map((device, idx) => (
                            <li key={idx}>
                              {device.quantity || 1}台{device.deviceName || '未知设备'}
                              {device.useYears ? `（使用${device.useYears}年）` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiDraft.missingFields.length > 0 && (
                      <div className="text-amber-600">
                        <span className="font-medium">待补充：</span>{aiDraft.missingFields.join('、')}
                      </div>
                    )}
                    {aiDraft.suggestions.length > 0 && (
                      <div className="text-blue-600">
                        <span className="font-medium">建议：</span>{aiDraft.suggestions.join('；')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setShowAiPreview(false)}>
                      返回修改需求
                    </Button>
                    <Button size="sm">
                      应用到报价单
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

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
                    <Label>选择客户</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleOpenClientSelector} className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        选择已有客户
                      </Button>
                      {customerName && (
                        <Badge variant="secondary" className="self-center">
                          当前: {customerName}
                        </Badge>
                      )}
                    </div>
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
                <div className="space-y-2">
                  <Label>备件选项</Label>
                  <div className="flex items-center space-x-2 rounded-md border border-slate-200 p-3">
                    <Switch
                      id="needSpareParts"
                      checked={needSpareParts}
                      onCheckedChange={(checked) => setNeedSpareParts(checked)}
                    />
                    <Label htmlFor="needSpareParts" className="cursor-pointer flex-1">
                      需要备件
                      <span className="block text-xs text-slate-500 font-normal mt-0.5">
                        勾选后将计入备件风险准备金
                      </span>
                    </Label>
                  </div>
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
                            onClick={() => setSelectedCategories(getDynamicDeviceCategories())}
                          >
                            全选
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {getDynamicDeviceCategories().map((category) => (
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
                          ? (dbDataLoading ? [] : dbDeviceQuotas)
                          : (dbDataLoading ? [] : dbDeviceQuotas).filter((d: any) => selectedCategories.includes(d.category));
                        
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
                            <TableHead>使用年限</TableHead>
                            <TableHead>成新率</TableHead>
                            <TableHead>故障率</TableHead>
                            <TableHead>预计故障次数</TableHead>
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
                                <Input
                                  type="number"
                                  min="0"
                                  value={(item as any).useYears ?? 1}
                                  onChange={(e) => handleUpdateUseYears(index, parseInt(e.target.value) || 1)}
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
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                  {(getFailureRate((item as any).useYears ?? 1, item.depreciationGrade) * 100).toFixed(0)}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-orange-50 text-orange-700">
                                  {(item.quantity * getFailureRate((item as any).useYears ?? 1, item.depreciationGrade)).toFixed(1)}
                                </Badge>
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
                                    const regionFactor = FULL_REGION_FACTORS[selectedRegionForSummary as keyof typeof FULL_REGION_FACTORS];
                                    
                                    // 计算基础费用（上面表格中显示的费用 × 数量 × 地区系数）
                                    const baseInspectionFee = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.inspectionFee * item.quantity * regionFactor, 0);
                                    const baseOnSiteFee = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.onSiteFee * item.quantity * regionFactor, 0);
                                    const baseFaultHandlingFee = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.faultHandlingFee * item.quantity * regionFactor, 0);
                                    const baseToolAmortization = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.toolAmortization * item.quantity * regionFactor, 0);
                                    const baseConsumableFee = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.consumableFee * item.quantity * regionFactor, 0);
                                    const baseSparePartReserve = fullQuoteResult.deviceItems.reduce((sum, item) => sum + item.sparePartReserve * item.quantity * regionFactor, 0);
                                    
                                    const totalBase = baseInspectionFee + baseOnSiteFee + baseFaultHandlingFee + baseToolAmortization + baseConsumableFee + baseSparePartReserve;
                                    const totalSubtotal = fullQuoteResult.totalByRegion[selectedRegionForSummary].subtotal;
                                    
                                    // 计算调整系数，确保费用明细加起来等于总价
                                    const adjustmentFactor = totalBase > 0 ? totalSubtotal / totalBase : 1;
                                    
                                    const feeItems = [
                                      { name: '巡检费', amount: baseInspectionFee * adjustmentFactor },
                                      { name: '上门费', amount: baseOnSiteFee * adjustmentFactor },
                                      { name: '故障处理费', amount: baseFaultHandlingFee * adjustmentFactor },
                                      { name: '工具仪表摊销', amount: baseToolAmortization * adjustmentFactor },
                                      { name: '耗材费', amount: baseConsumableFee * adjustmentFactor },
                                      { name: '备件风险准备金', amount: baseSparePartReserve * adjustmentFactor },
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
                    <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          className="border-orange-600 text-orange-700 hover:bg-orange-50"
                          onClick={handleOpenPriceSettings}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          价格设置
                        </Button>
                        <Button
                          variant="outline"
                          className="border-blue-600 text-blue-700 hover:bg-blue-50"
                          onClick={handleOpenHistoryDialog}
                        >
                          <History className="h-4 w-4 mr-2" />
                          历史报价复用
                        </Button>
                        <Button
                          variant="outline"
                          className="border-purple-600 text-purple-700 hover:bg-purple-50"
                          onClick={handleBatchEdit}
                          disabled={selectedDevices.length === 0}
                        >
                          <Filter className="h-4 w-4 mr-2" />
                          批量编辑 ({batchSelected.length > 0 ? batchSelected.length : ''})
                        </Button>
                        <Button
                          variant="outline"
                          className="border-cyan-600 text-cyan-700 hover:bg-cyan-50"
                          onClick={() => setShowProfessionalExportDialog(true)}
                          disabled={!quoteResult && !fullQuoteResult}
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          专业导出
                        </Button>
                        <Button
                          variant="outline"
                          className="border-indigo-600 text-indigo-700 hover:bg-indigo-50"
                          onClick={handleOpenShareDialog}
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          分享
                        </Button>
                        <Button
                          variant="outline"
                          className="border-teal-600 text-teal-700 hover:bg-teal-50"
                          onClick={() => setShowSaveVersionDialog(true)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          保存版本
                        </Button>
                        <Button
                          variant="outline"
                          className="border-amber-600 text-amber-700 hover:bg-amber-50"
                          onClick={() => setShowReviewDialog(true)}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          提交审核
                        </Button>
                        <Button
                          className="bg-blue-700 hover:bg-blue-800"
                          onClick={handleSaveQuote}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          保存报价
                        </Button>
                        <Button variant="outline">
                          <Printer className="h-4 w-4 mr-2" />
                          打印
                        </Button>
                        <Button
                          variant="outline"
                          className="border-purple-600 text-purple-700 hover:bg-purple-50"
                          onClick={handleExportQuote}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          导出Word
                        </Button>
                        <Button
                          variant="outline"
                          className="border-green-600 text-green-700 hover:bg-green-50"
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
                      {(['5x8', '7x8', '7x24'] as unknown as ServiceTimeType[]).map((type) => (
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
                      {(['2小时内', '8小时内'] as unknown as ArrivalTimeType[]).map((type) => (
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
                      {(['10分钟内', '30分钟内'] as unknown as ResponseTimeType[]).map((type) => (
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
              alert('查勘记录保存成功！');
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

      {/* AI信息补充对话框 */}
      <Dialog open={showAiCompletionDialog} onOpenChange={setShowAiCompletionDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl">完善报价信息</DialogTitle>
            <DialogDescription>
              AI已识别初步信息，请补充缺失的字段以生成完整报价
            </DialogDescription>
          </DialogHeader>
          
          {completionDraft && (
            <div className="overflow-y-auto max-h-[60vh] space-y-6">
              {/* 已识别的设备 */}
              <div>
                <h3 className="font-semibold mb-3">已识别的设备</h3>
                <div className="space-y-3">
                  {completionDraft.devices.map((device, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>设备名称</Label>
                            <Input 
                              value={device.deviceName || ''} 
                              onChange={(e) => {
                                const newDraft = { ...completionDraft };
                                newDraft.devices[index] = { ...device, deviceName: e.target.value };
                                setCompletionDraft(newDraft);
                              }}
                            />
                          </div>
                          <div>
                            <Label>数量</Label>
                            <Input 
                              type="number"
                              value={device.quantity || 1} 
                              onChange={(e) => {
                                const newDraft = { ...completionDraft };
                                newDraft.devices[index] = { ...device, quantity: parseInt(e.target.value) || 1 };
                                setCompletionDraft(newDraft);
                              }}
                            />
                          </div>
                          <div>
                            <Label>使用年限</Label>
                            <Input 
                              type="number"
                              value={device.useYears || 1} 
                              onChange={(e) => {
                                const newDraft = { ...completionDraft };
                                newDraft.devices[index] = { ...device, useYears: parseInt(e.target.value) || 1 };
                                setCompletionDraft(newDraft);
                              }}
                            />
                          </div>
                          <div>
                            <Label>是否在保</Label>
                            <Select 
                              value={device.underWarranty ? 'true' : 'false'} 
                              onValueChange={(val) => {
                                const newDraft = { ...completionDraft };
                                newDraft.devices[index] = { ...device, underWarranty: val === 'true' };
                                setCompletionDraft(newDraft);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="false">不在保</SelectItem>
                                <SelectItem value="true">在保</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {completionDraft.quotaList && completionDraft.quotaList.length > 0 && (
                          <div>
                            <Label>从定额库选择设备</Label>
                            <Select 
                              value={device.matchedDeviceId || ''} 
                              onValueChange={(val) => {
                                const newDraft = { ...completionDraft };
                                const selectedQuota = newDraft.quotaList?.find((q: any) => q.id === val);
                                newDraft.devices[index] = { 
                                  ...device, 
                                  matchedDeviceId: val,
                                  matchedDeviceName: selectedQuota?.name
                                };
                                setCompletionDraft(newDraft);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="选择设备" />
                              </SelectTrigger>
                              <SelectContent className="max-h-80">
                                {completionDraft.quotaList.map((quota: any) => (
                                  <SelectItem key={quota.id} value={quota.id}>
                                    {quota.category} - {quota.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* 项目基本信息 */}
              <div>
                <h3 className="font-semibold mb-3">项目基本信息</h3>
                <Card>
                  <CardContent className="pt-4 grid grid-cols-2 gap-3">
                    <div>
                      <Label>服务地区 *</Label>
                      <Select 
                        value={completionDraft.region || ''} 
                        onValueChange={(val) => {
                          const newDraft = { ...completionDraft };
                          newDraft.region = val as any;
                          setCompletionDraft(newDraft);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择地区" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="城区">城区</SelectItem>
                          <SelectItem value="市区县城郊区">市区县城郊区</SelectItem>
                          <SelectItem value="乡镇">乡镇</SelectItem>
                          <SelectItem value="农村">农村</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>合同年限 *</Label>
                      <Input 
                        type="number"
                        value={completionDraft.contractYears || 1} 
                        onChange={(e) => {
                          const newDraft = { ...completionDraft };
                          newDraft.contractYears = parseInt(e.target.value) || 1;
                          setCompletionDraft(newDraft);
                        }}
                      />
                    </div>
                    <div>
                      <Label>年度巡检次数 *</Label>
                      <Select 
                        value={String(completionDraft.annualInspectionCount || 4)} 
                        onValueChange={(val) => {
                          const newDraft = { ...completionDraft };
                          newDraft.annualInspectionCount = parseInt(val) || 4;
                          setCompletionDraft(newDraft);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">每半年一次 (2次/年)</SelectItem>
                          <SelectItem value="4">每季度一次 (4次/年)</SelectItem>
                          <SelectItem value="12">每月一次 (12次/年)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>到场时间</Label>
                      <Select 
                        value={completionDraft.arrivalTime || ''} 
                        onValueChange={(val) => {
                          const newDraft = { ...completionDraft };
                          newDraft.arrivalTime = val as '2小时内' | '8小时内' | '4小时' | '24小时';
                          setCompletionDraft(newDraft);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择到场时间" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4小时">4小时</SelectItem>
                          <SelectItem value="8小时内">8小时内</SelectItem>
                          <SelectItem value="24小时">24小时</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>响应时间</Label>
                      <Select 
                        value={completionDraft.responseTime || ''} 
                        onValueChange={(val) => {
                          const newDraft = { ...completionDraft };
                          newDraft.responseTime = val as '10分钟内' | '30分钟内' | '1小时内' | '15分钟内';
                          setCompletionDraft(newDraft);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择响应时间" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15分钟内">15分钟内</SelectItem>
                          <SelectItem value="30分钟内">30分钟内</SelectItem>
                          <SelectItem value="1小时内">1小时内</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>服务时间</Label>
                      <Select 
                        value={completionDraft.serviceTime || ''} 
                        onValueChange={(val) => {
                          const newDraft = { ...completionDraft };
                          newDraft.serviceTime = val as '5x8' | '7x8' | '7x24';
                          setCompletionDraft(newDraft);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择服务时间" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5x8">5x8</SelectItem>
                          <SelectItem value="7x8">7x8</SelectItem>
                          <SelectItem value="7x24">7x24</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 缺失字段提示 */}
              {completionDraft.missingFields && completionDraft.missingFields.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-orange-600">⚠️ 还需要补充的信息</h3>
                  <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="pt-4">
                      <ul className="list-disc list-inside space-y-1 text-orange-800">
                        {completionDraft.missingFields.map((field, idx) => (
                          <li key={idx}>{field}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* AI建议 */}
              {completionDraft.suggestions && completionDraft.suggestions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-blue-600">💡 AI建议</h3>
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-4">
                      <ul className="list-disc list-inside space-y-1 text-blue-800">
                        {completionDraft.suggestions.map((suggestion, idx) => (
                          <li key={idx}>{suggestion}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowAiCompletionDialog(false);
                setCompletionDraft(null);
              }}
            >
              取消
            </Button>
            <Button 
              variant="secondary"
              onClick={() => {
                setShowAiCompletionDialog(false);
                setShowAiPreview(true);
                setAiDraft(completionDraft);
              }}
            >
              查看识别结果
            </Button>
            <Button 
              className="bg-blue-700 hover:bg-blue-800"
              onClick={() => {
                if (!completionDraft) return;
                
                // 应用到报价单
                setAiDraft(completionDraft);
                
                // 设置地区
                if (completionDraft.region) {
                  setRegion(completionDraft.region as any);
                }
                
                // 设置合同年限
                if (completionDraft.contractYears) {
                  setContractYears(String(completionDraft.contractYears));
                }
                
                // 创建设备
                const newDevices = completionDraft.devices.map((d: any) => {
                  const quota = d.matchedDeviceId 
                    ? (dbDataLoading ? null : dbDeviceQuotas.find((q: any) => q.id === d.matchedDeviceId))
                    : (dbDataLoading ? null : dbDeviceQuotas[0]);
                  
                  if (!quota) return null;
                  
                  return {
                    quota,
                    quantity: d.quantity || 1,
                    useYears: d.useYears ?? 1,
                    underWarranty: d.underWarranty || false,
                    slaConfig: {
                      teamExperience: '有',
                      securityLevel: '二级',
                      supportMode: '现场支持为主',
                      faultRecoveryTime: '≤24h',
                      arrivalTime: completionDraft.arrivalTime || '8小时内',
                      responseTime: completionDraft.responseTime || '30分钟内',
                      serviceTime: completionDraft.serviceTime || '5x8',
                    }
                  };
                }).filter((d): d is any => d !== null);
                
                if (newDevices.length > 0) {
                  setSelectedDevices(newDevices);
                }
                
                // 关闭对话框
                setShowAiCompletionDialog(false);
                setCompletionDraft(null);
                setShowAiPreview(false);
              }}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              应用到报价单
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
                  value={slaConfigDevice.slaConfig?.arrivalTime || '8小时内'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          arrivalTime: value as '2小时内' | '8小时内',
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
                  value={slaConfigDevice.slaConfig?.responseTime || '30分钟内'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          responseTime: value as '10分钟内' | '30分钟内',
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
                  value={slaConfigDevice.slaConfig?.serviceTime || '5x8'}
                  onValueChange={(value) => {
                    if (slaConfigDevice.slaConfig) {
                      setSlaConfigDevice({
                        ...slaConfigDevice,
                        slaConfig: {
                          ...slaConfigDevice.slaConfig,
                          serviceTime: value as '5x8' | '7x8' | '7x24',
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
                      arrivalTime: '8小时内',
                      responseTime: '30分钟内',
                      serviceTime: '5x8',
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

      {/* 价格设置对话框 */}
      <Dialog open={showPriceSettings} onOpenChange={setShowPriceSettings}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-600" />
              价格设置
            </DialogTitle>
            <DialogDescription>
              自定义调整各项价格，设置完成后可以选择暂时保存或永久保存
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* 设备价格设置 */}
            {useFullData && fullQuoteResult && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">设备价格设置</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-1/3">设备名称</TableHead>
                        <TableHead className="w-1/6">数量</TableHead>
                        <TableHead className="w-1/4">当前单价</TableHead>
                        <TableHead className="w-1/4">自定义单价</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fullQuoteResult.deviceItems.map((item, index) => {
                        const key = `device_${index}`;
                        // 根据当前地区获取对应的价格
                        let currentPrice = 0;
                        switch (region) {
                          case '城区':
                            currentPrice = item.cityPrice;
                            break;
                          case '市区县城郊区':
                            currentPrice = item.urbanPrice;
                            break;
                          case '乡镇':
                            currentPrice = item.townPrice;
                            break;
                          case '农村':
                            currentPrice = item.ruralPrice;
                            break;
                          default:
                            currentPrice = item.cityPrice;
                        }
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.quota.name}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrencyLocal(currentPrice)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={priceSettings[key] || currentPrice}
                                onChange={(e) => {
                                  const newPrice = parseFloat(e.target.value) || 0;
                                  setPriceSettings({
                                    ...priceSettings,
                                    [key]: newPrice
                                  });
                                }}
                                min="0"
                                step="0.01"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 费用项目设置 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">费用项目设置</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4">
                  <Label className="min-w-[100px]">巡检费</Label>
                  <Input
                    type="number"
                    value={priceSettings.inspectionFee}
                    onChange={(e) => setPriceSettings(prev => ({
                      ...prev,
                      inspectionFee: Number(e.target.value) || 0
                    }))}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <Label className="min-w-[100px]">上门费</Label>
                  <Input
                    type="number"
                    value={priceSettings.onSiteFee}
                    onChange={(e) => setPriceSettings(prev => ({
                      ...prev,
                      onSiteFee: Number(e.target.value) || 0
                    }))}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <Label className="min-w-[100px]">故障处理费</Label>
                  <Input
                    type="number"
                    value={priceSettings.faultHandlingFee}
                    onChange={(e) => setPriceSettings(prev => ({
                      ...prev,
                      faultHandlingFee: Number(e.target.value) || 0
                    }))}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <Label className="min-w-[100px]">工具摊销</Label>
                  <Input
                    type="number"
                    value={priceSettings.toolAmortization}
                    onChange={(e) => setPriceSettings(prev => ({
                      ...prev,
                      toolAmortization: Number(e.target.value) || 0
                    }))}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <Label className="min-w-[100px]">耗材费</Label>
                  <Input
                    type="number"
                    value={priceSettings.consumableFee}
                    onChange={(e) => setPriceSettings(prev => ({
                      ...prev,
                      consumableFee: Number(e.target.value) || 0
                    }))}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <Label className="min-w-[100px]">备件准备金</Label>
                  <Input
                    type="number"
                    value={priceSettings.sparePartReserve}
                    onChange={(e) => setPriceSettings(prev => ({
                      ...prev,
                      sparePartReserve: Number(e.target.value) || 0
                    }))}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* 系数设置 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">系数设置</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-4">
                  <Label className="min-w-[100px]">在保系数</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={priceSettings.inWarrantyFactor}
                    onChange={(e) => setPriceSettings(prev => ({
                      ...prev,
                      inWarrantyFactor: Number(e.target.value) || 0.5
                    }))}
                    className="flex-1"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500">
                在保系数：在保设备价格调整系数，0.5表示减半，1表示不调整
              </p>
            </div>

            {/* 保存类型选择 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">保存设置</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="min-w-[80px]">保存类型</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="saveType"
                        value="temp"
                        checked={saveType === 'temp'}
                        onChange={() => setSaveType('temp')}
                        className="w-4 h-4"
                      />
                      <span>暂时保存</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="saveType"
                        value="permanent"
                        checked={saveType === 'permanent'}
                        onChange={() => setSaveType('permanent')}
                        className="w-4 h-4"
                      />
                      <span>永久保存</span>
                    </label>
                  </div>
                </div>
                
                {saveType === 'permanent' && (
                  <div className="flex items-center gap-4">
                    <Label className="min-w-[80px]">管理员密码</Label>
                    <Input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="请输入管理员密码"
                      className="max-w-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPriceSettings(false);
                setAdminPassword('');
              }}
            >
              取消
            </Button>
            <Button 
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleSavePriceSettings}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveType === 'permanent' ? '永久保存' : '暂时保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 历史报价复用对话框 */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>历史报价复用</DialogTitle>
            <DialogDescription>选择历史报价，快速复制设备列表到当前报价</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {historyLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">加载中...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleSelectHistoryQuote(quote)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{quote.quoteNumber}</span>
                        <Badge variant="outline">{quote.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        客户：{quote.clientName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        创建时间：{quote.createdAt}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">¥{quote.totalAmount.toLocaleString()}</div>
                      <Button size="sm" variant="outline" className="mt-2">
                        <Copy className="h-4 w-4 mr-1" />
                        复制
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量编辑对话框 */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量编辑设备</DialogTitle>
            <DialogDescription>已选择 {batchSelected.length} 个设备</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>数量</Label>
              <Input
                type="number"
                placeholder="统一修改数量"
                value={batchQuantity}
                onChange={(e) => setBatchQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>服务年限</Label>
              <Input
                type="number"
                placeholder="统一修改服务年限"
                value={batchYears}
                onChange={(e) => setBatchYears(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
              取消
            </Button>
            <Button onClick={applyBatchEdit}>
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分享对话框 */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分享报价</DialogTitle>
            <DialogDescription>生成分享链接，客户可通过链接查看报价</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>分享链接</Label>
              <div className="flex gap-2">
                <Input
                  value={shareLink || '点击下方按钮生成分享链接'}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={handleGenerateShareLink} variant="outline">
                  <Link2 className="h-4 w-4 mr-1" />
                  生成
                </Button>
              </div>
            </div>
            {shareLink && (
              <div className="space-y-2">
                <Button onClick={handleCopyShareLink} className="w-full">
                  {shareLinkCopied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      复制链接
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
