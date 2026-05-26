'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
  SERVICE_TIME_FACTORS,
  REGION_FACTORS,
  MULTI_YEAR_DISCOUNTS,
  EngineerLevel,
} from '@/lib/maintenance-quota';
// 新完整数据结构
import {
  FULL_DEVICE_QUOTAS,
  getDeviceCategories,
  getDevicesByCategory,
  searchDevices,
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
  SLAConfig,
  DEFAULT_SLA_CONFIG,
  FULL_MAINTENANCE_LEVEL_CONFIG,
  REGION_FACTORS as FULL_REGION_FACTORS,
  type FullDeviceQuota,
} from '@/lib/device-quota-full';
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

export default function MaintenanceQuotePage() {
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
  
  // 设备分类筛选
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // SLA配置（使用新数据结构）
  const [slaConfig, setSlaConfig] = useState<SLAConfig>(DEFAULT_SLA_CONFIG);

  // 设备选择和数量（支持新老两种数据结构）
  const [selectedDevices, setSelectedDevices] = useState<Array<{
    quota: DeviceQuota | FullDeviceQuota;
    quantity: number;
    depreciationLevel: DepreciationLevel;
    inWarranty: boolean;
  }>>([]);

  // 计算结果（支持新老两种）
  const [quoteResult, setQuoteResult] = useState<MaintenanceQuoteResult | null>(null);
  const [fullQuoteResult, setFullQuoteResult] = useState<FullMaintenanceQuoteResult | null>(null);
  
  // 查勘问询
  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswer[]>([]);

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
      setSelectedDevices([...selectedDevices, {
        quota,
        quantity: 1,
        depreciationLevel: '全新',
        inWarranty: false,
      }]);
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
      setSelectedDevices([...selectedDevices, {
        quota,
        quantity: 1,
        depreciationLevel: '全新',
        inWarranty: false,
      }]);
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
  const handleUpdateDepreciation = (index: number, level: DepreciationLevel) => {
    const newDevices = [...selectedDevices];
    newDevices[index].depreciationLevel = level;
    setSelectedDevices(newDevices);
  };

  // 更新在保状态
  const handleUpdateWarranty = (index: number, inWarranty: boolean) => {
    const newDevices = [...selectedDevices];
    newDevices[index].inWarranty = inWarranty;
    setSelectedDevices(newDevices);
  };

  // 移除设备
  const handleRemoveDevice = (index: number) => {
    const newDevices = [...selectedDevices];
    newDevices.splice(index, 1);
    setSelectedDevices(newDevices);
  };

  // 计算报价（支持新老两种模式）
  const handleCalculate = () => {
    if (selectedDevices.length === 0) return;

    if (useFullData) {
      // 使用新的完整计算逻辑
      const fullDevices = selectedDevices.map(item => ({
        quota: item.quota as FullDeviceQuota,
        quantity: item.quantity,
        depreciationLevel: item.depreciationLevel,
        inWarranty: item.inWarranty,
      }));
      
      const result = calculateFullMaintenanceQuote(
        fullDevices,
        slaConfig,
        parseInt(contractYears),
        region
      );
      setFullQuoteResult(result);
      setQuoteResult(null);
    } else {
      // 使用旧的计算逻辑（向后兼容）
      const oldDevices = selectedDevices.map(item => ({
        quota: item.quota as DeviceQuota,
        quantity: item.quantity,
        depreciationLevel: item.depreciationLevel as OldDepreciationLevel,
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

  // 导出报价单 - 简化版本
  const handleExportQuote = () => {
    if (!quoteResult || selectedDevices.length === 0) return;

    // 生成报价单号
    const timestamp = Date.now();
    const quoteNumber = `WB${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(timestamp % 1000).padStart(3, '0')}`;

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
        subtotalBeforeDiscount: quoteResult.subtotal,
        slaAdjustment: 0,
        regionAdjustment: 0,
        subtotalAfterCoefficients: quoteResult.subtotal,
        yearsDiscountAmount: 0,
        bulkDiscountAmount: 0,
        subtotal: quoteResult.subtotal,
        tax: quoteResult.taxAmount,
        grandTotal: quoteResult.totalByYear[parseInt(contractYears) as 1 | 2 | 3],
        grandTotalRMB: convertToChineseCurrency(quoteResult.totalByYear[parseInt(contractYears) as 1 | 2 | 3]),
      },
    };

    const html = generateMaintenanceQuoteHTML(simpleExportData);
    downloadAsWord(html, `维保报价单_${quoteNumber}.doc`);
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

  // 格式化金额（使用新的格式化函数）
  const formatCurrencyLocal = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">维保报价</h1>
          <p className="text-slate-500 mt-1">基于设备维保定额库的专业报价系统</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            导出Excel
          </Button>
          <Button className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800">
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
          <div className="grid gap-6 lg:grid-cols-3">
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
                  
                  {/* 设备分类筛选（仅新版） */}
                  {useFullData && (
                    <div className="space-y-2 mb-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">设备分类</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => setSelectedCategory('all')}
                        >
                          显示全部
                        </Button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          key="all" 
                          variant={selectedCategory === 'all' ? 'default' : 'outline'} 
                          size="sm"
                          className="text-xs"
                          onClick={() => setSelectedCategory('all')}
                        >
                          全部
                        </Button>
                        {getDeviceCategories().map((category) => (
                          <Button 
                            key={category} 
                            variant={selectedCategory === category ? 'default' : 'outline'} 
                            size="sm"
                            className="text-xs"
                            onClick={() => setSelectedCategory(category)}
                          >
                            {category}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                    {useFullData ? (
                      // 新版：使用完整设备数据（按分类筛选）
                      (() => {
                        const filteredDevices = selectedCategory === 'all' 
                          ? FULL_DEVICE_QUOTAS 
                          : FULL_DEVICE_QUOTAS.filter(d => d.category === selectedCategory);
                        
                        return (
                          <>
                            {filteredDevices.length === 0 && (
                              <div className="col-span-full text-center py-4 text-slate-500 text-sm">
                                该分类下暂无设备
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
                                      {formatCurrencyLocal(quota.cityPrice)}
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
                            <TableHead className="w-12"></TableHead>
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
                                  onValueChange={(v) => handleUpdateDepreciation(index, v as DepreciationLevel)}
                                >
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="全新">全新</SelectItem>
                                    <SelectItem value="较新">较新</SelectItem>
                                    <SelectItem value="一般">一般</SelectItem>
                                    <SelectItem value="偏旧">偏旧</SelectItem>
                                    <SelectItem value="老旧">老旧</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={item.inWarranty}
                                  onCheckedChange={(checked) => handleUpdateWarranty(index, checked)}
                                />
                              </TableCell>
                              {/* 新版：显示4个地区报价 */}
                              {useFullData && 'cityPrice' in item.quota && (
                                <>
                                  <TableCell className="text-right">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                      {formatCurrencyLocal((item.quota as FullDeviceQuota).cityPrice)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right text-xs text-slate-500">
                                    {formatCurrencyLocal((item.quota as FullDeviceQuota).urbanPrice)}
                                  </TableCell>
                                </>
                              )}
                              {/* 旧版：只显示城区报价 */}
                              {!useFullData && (
                                <TableCell>{formatCurrencyLocal(item.quota.cityPrice)}</TableCell>
                              )}
                              <TableCell className="font-medium">
                                {formatCurrencyLocal(item.quota.cityPrice * item.quantity)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveDevice(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
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
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 lg:grid-cols-3">
                    {/* 费用明细 */}
                    <div className="lg:col-span-2">
                      <h3 className="text-lg font-semibold mb-4">费用明细</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>设备名称</TableHead>
                            <TableHead>数量</TableHead>
                            <TableHead>巡检费</TableHead>
                            <TableHead>上门费</TableHead>
                            <TableHead>故障处理费</TableHead>
                            <TableHead>其他费用</TableHead>
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
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.inspectionFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.onSiteFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.faultHandlingFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.toolAmortization + item.consumableFee + item.sparePartReserve)}</TableCell>
                                <TableCell className="text-right">{formatCurrencyLocal(item.cityPrice)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrencyLocal(item.totalAfterDiscount)}</TableCell>
                              </TableRow>
                            ))
                          ) : quoteResult ? (
                            // 旧版：保持向后兼容
                            quoteResult.deviceItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.quota.name}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.inspectionFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.onSiteFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.faultHandlingFee)}</TableCell>
                                <TableCell>{formatCurrencyLocal(item.toolAmortization + item.consumableFee + item.sparePartReserve)}</TableCell>
                                <TableCell className="text-right">{formatCurrencyLocal(item.cityPrice)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrencyLocal(item.totalAfterDiscount)}</TableCell>
                              </TableRow>
                            ))
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>

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
                              <div key={region} className="p-3 bg-slate-50 rounded-lg">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{region}</span>
                                  <span className="text-lg font-bold text-blue-700">
                                    {formatCurrencyLocal(data.total)}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  不含税: {formatCurrencyLocal(data.subtotal)} · 
                                  税额: {formatCurrencyLocal(data.taxAmount)}
                                </div>
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

                      {((useFullData && fullQuoteResult) || (!useFullData && quoteResult)) && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">多年期报价</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {useFullData && fullQuoteResult ? (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">1年期总价</span>
                                  <span className="font-medium">{formatCurrencyLocal(fullQuoteResult.totalByYear[1])}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">2年期总价 (95折)</span>
                                  <span className="font-medium text-orange-600">{formatCurrencyLocal(fullQuoteResult.totalByYear[2])}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">3年期总价 (9折)</span>
                                  <span className="font-medium text-green-600">{formatCurrencyLocal(fullQuoteResult.totalByYear[3])}</span>
                                </div>
                              </>
                            ) : quoteResult ? (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">1年期总价</span>
                                  <span className="font-medium">{formatCurrencyLocal(quoteResult.totalByYear[1])}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">2年期总价 (95折)</span>
                                  <span className="font-medium text-orange-600">{formatCurrencyLocal(quoteResult.totalByYear[2])}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">3年期总价 (9折)</span>
                                  <span className="font-medium text-green-600">{formatCurrencyLocal(quoteResult.totalByYear[3])}</span>
                                </div>
                              </>
                            ) : null}
                          </CardContent>
                        </Card>
                      )}

                      <div className="flex gap-2">
                        <Button className="flex-1 bg-blue-700 hover:bg-blue-800">
                          <Save className="h-4 w-4 mr-2" />
                          保存报价
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Printer className="h-4 w-4 mr-2" />
                          打印
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 border-green-600 text-green-700 hover:bg-green-50"
                          onClick={handleExportQuote}
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          导出Word
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备分类</TableHead>
                    <TableHead>设备名称</TableHead>
                    <TableHead>规格型号</TableHead>
                    <TableHead>维保分档</TableHead>
                    <TableHead>工程师等级</TableHead>
                    <TableHead className="text-right">城区报价</TableHead>
                    <TableHead>核心维保内容</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {useFullData ? (
                    // 新版：使用完整设备数据
                    FULL_DEVICE_QUOTAS.map((quota) => (
                      <TableRow key={quota.id}>
                        <TableCell className="font-medium">{quota.category}</TableCell>
                        <TableCell>{quota.name}</TableCell>
                        <TableCell className="text-slate-500">{quota.model}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {quota.level}档 - {quota.levelName}
                          </Badge>
                        </TableCell>
                        <TableCell>{quota.engineerLevel}</TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-1">
                            <div className="font-medium text-blue-700">
                              {formatCurrencyLocal(quota.cityPrice)}
                            </div>
                            <div className="text-xs text-slate-500">
                              市区: {formatCurrencyLocal(quota.urbanPrice)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-slate-500 text-sm">
                          {quota.coreMaintenanceContent}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAddFullDevice(quota)}
                          >
                            <Plus className="h-4 w-4 text-blue-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    // 旧版：保持向后兼容
                    MOCK_DEVICE_QUOTAS.map((quota) => (
                      <TableRow key={quota.id}>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* SLA参数配置 */}
        <TabsContent value="sla" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
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
                </div>
              </CardContent>
              <CardFooter className="border-t bg-slate-50">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <span className="text-sm text-slate-500">当前SLA总系数：</span>
                    <span className="ml-2 text-lg font-bold text-blue-700">
                      {(slaConfig.teamExperience * slaConfig.securityLevel * slaConfig.supportMode * 
                        slaConfig.faultRecoveryTime * slaConfig.arrivalTime * slaConfig.responseTime * 
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
    </div>
  );
}
