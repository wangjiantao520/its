'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/user-context';
import { DeviceImportItem, getDeviceImports, addDeviceImport, type MaintenanceLevel, type EngineerLevel, type DepreciationLevel } from '@/lib/roles';
import { FULL_DEVICE_QUOTAS } from '@/lib/complete-device-data';
import { DEVICE_GRADE_OPTIONS, DEPRECIATION_GRADE_OPTIONS, type DeviceGrade, type DepreciationGrade } from '@/lib/device-grade';
import { Upload, Trash2, CheckCircle2, XCircle, Clock } from 'lucide-react';

const DEVICE_CATEGORIES = [
  '计算机终端类',
  '办公外设&存储',
  '打印复印扫描类',
  '音视频会议系统',
  '网络基础设备',
  '视频监控系统',
  '机房环境设备',
  '办公环境及后勤',
  '服务器&存储',
  '自助终端&专用设备'
];

const MAINTENANCE_LEVELS: { value: MaintenanceLevel; label: string }[] = [
  { value: 'A', label: '简易型A档' },
  { value: 'B', label: '基础型B档' },
  { value: 'C', label: '中级型C档' },
  { value: 'D', label: '高级型D档' },
  { value: 'E', label: '专家型E档' }
];

const ENGINEER_LEVELS: { value: EngineerLevel; label: string }[] = [
  { value: '初级', label: '初级（404元/天）' },
  { value: '中级', label: '中级（543元/天）' },
  { value: '高级', label: '高级（700元/天）' }
];

const DEPRECIATION_LEVELS: { value: DepreciationLevel; label: string }[] = [
  { value: '全新', label: '全新（0-1年）' },
  { value: '较新', label: '较新（1-3年）' },
  { value: '一般', label: '一般（3-5年）' },
  { value: '偏旧', label: '偏旧（5-8年）' },
  { value: '老旧', label: '老旧（8年以上）' }
];

export default function DeviceImportPage() {
  const { user, isLoggedIn } = useUser();

  // 如果未登录，不渲染内容
  if (!isLoggedIn || !user) {
    return null;
  }
  const [devices, setDevices] = useState<Partial<DeviceImportItem>[]>([]);
  const [currentDevice, setCurrentDevice] = useState<Partial<DeviceImportItem>>({
    category: '',
    name: '',
    model: '',
    level: 'B',
    engineerLevel: '初级',
    deviceCount: 1,
    needSparePart: false,
    contractYears: 1
  });
  const [importRecords, setImportRecords] = useState<DeviceImportItem[]>(getDeviceImports());
  const [activeTab, setActiveTab] = useState('form');

  const handleAddDevice = () => {
    // 验证必填字段
    if (!currentDevice.category || !currentDevice.name || !currentDevice.model || 
        !currentDevice.level || !currentDevice.engineerLevel || 
        currentDevice.deviceCount === undefined || currentDevice.deviceCount <= 0 ||
        !currentDevice.deviceGrade || !currentDevice.depreciationGrade) {
      alert('请填写所有必填字段（带*号），包括设备分档和成新率等级');
      return;
    }

    setDevices([...devices, { ...currentDevice }]);
    
    // 重置表单
    setCurrentDevice({
      category: '',
      name: '',
      model: '',
      level: 'B',
      engineerLevel: '初级',
      deviceCount: 1,
      needSparePart: false,
      contractYears: 1,
      deviceGrade: undefined,
      depreciationGrade: undefined
    });
  };

  const handleRemoveDevice = (index: number) => {
    setDevices(devices.filter((_, i) => i !== index));
  };

  const handleSubmitImport = () => {
    if (devices.length === 0) {
      alert('请先添加设备');
      return;
    }

    devices.forEach(device => {
      addDeviceImport({
        ...device,
        category: device.category || '',
        name: device.name || '',
        model: device.model || '',
        level: device.level || 'B',
        engineerLevel: device.engineerLevel || '初级',
        deviceCount: device.deviceCount || 1,
        needSparePart: device.needSparePart || false,
        contractYears: device.contractYears || 1,
        submittedBy: user.name
      } as any);
    });

    setImportRecords(getDeviceImports());
    setDevices([]);
    setActiveTab('records');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="w-3 h-3" /> 待审核</Badge>;
      case 'approved':
        return <Badge variant="default" className="flex items-center gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" /> 已通过</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> 已拒绝</Badge>;
      default:
        return null;
    }
  };

  if (user.role !== 'its_member' && user.role !== 'admin') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">请先在侧边栏选择角色</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">设备清单导入</h1>
        <p className="text-gray-600">填写设备信息并提交审核</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="form">填写表单</TabsTrigger>
          <TabsTrigger value="list">设备清单</TabsTrigger>
          <TabsTrigger value="records">导入记录</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>添加设备</CardTitle>
              <CardDescription>填写设备详细信息，所有字段都要填写才能申请导入</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 第一组：基础信息 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">基础信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">设备分类 *</Label>
                    <select
                      id="category"
                      value={currentDevice.category}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, category: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="">请选择</option>
                      {DEVICE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">设备名称 *</Label>
                    <Input
                      id="name"
                      value={currentDevice.name}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, name: e.target.value })}
                      placeholder="请输入设备名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">规格/型号 *</Label>
                    <Input
                      id="model"
                      value={currentDevice.model}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, model: e.target.value })}
                      placeholder="请输入规格型号"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="level">维保分档 *</Label>
                    <select
                      id="level"
                      value={currentDevice.level}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, level: e.target.value as MaintenanceLevel })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      {MAINTENANCE_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="engineerLevel">进场工程师等级 *</Label>
                    <select
                      id="engineerLevel"
                      value={currentDevice.engineerLevel}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, engineerLevel: e.target.value as EngineerLevel })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      {ENGINEER_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deviceCount">设备数量 *</Label>
                    <Input
                      id="deviceCount"
                      type="number"
                      min="1"
                      value={currentDevice.deviceCount}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, deviceCount: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deviceGrade">设备分档 *</Label>
                    <select
                      id="deviceGrade"
                      value={currentDevice.deviceGrade || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, deviceGrade: e.target.value as DeviceGrade })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">请选择设备分档</option>
                      {DEVICE_GRADE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depreciationGrade">成新率等级 *</Label>
                    <select
                      id="depreciationGrade"
                      value={currentDevice.depreciationGrade || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, depreciationGrade: parseInt(e.target.value) as DepreciationGrade })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">请选择成新率等级</option>
                      {DEPRECIATION_GRADE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 第二组：系数配置 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">系数配置</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamExperienceWithFactor">运维团队经验-有系数</Label>
                    <Input
                      id="teamExperienceWithFactor"
                      type="number"
                      step="0.1"
                      value={currentDevice.teamExperienceWithFactor || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, teamExperienceWithFactor: parseFloat(e.target.value) || undefined })}
                      placeholder="1.2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamExperienceSimilarFactor">运维团队经验-类似系数</Label>
                    <Input
                      id="teamExperienceSimilarFactor"
                      type="number"
                      step="0.1"
                      value={currentDevice.teamExperienceSimilarFactor || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, teamExperienceSimilarFactor: parseFloat(e.target.value) || undefined })}
                      placeholder="1.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamExperienceWithoutFactor">运维团队经验-无系数</Label>
                    <Input
                      id="teamExperienceWithoutFactor"
                      type="number"
                      step="0.1"
                      value={currentDevice.teamExperienceWithoutFactor || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, teamExperienceWithoutFactor: parseFloat(e.target.value) || undefined })}
                      placeholder="0.8"
                    />
                  </div>
                  {/* 安全等级系数 */}
                  <div className="space-y-2">
                    <Label htmlFor="securityLevel3Factor">安全等级-第三级系数</Label>
                    <Input
                      id="securityLevel3Factor"
                      type="number"
                      step="0.01"
                      value={currentDevice.securityLevel3Factor || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, securityLevel3Factor: parseFloat(e.target.value) || undefined })}
                      placeholder="1.0"
                    />
                  </div>
                  {/* 支持方式系数 */}
                  <div className="space-y-2">
                    <Label htmlFor="supportModeOnsiteFactor">支持方式-现场支持为主系数</Label>
                    <Input
                      id="supportModeOnsiteFactor"
                      type="number"
                      step="0.01"
                      value={currentDevice.supportModeOnsiteFactor || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, supportModeOnsiteFactor: parseFloat(e.target.value) || undefined })}
                      placeholder="1.0"
                    />
                  </div>
                  {/* 故障恢复时间系数 */}
                  <div className="space-y-2">
                    <Label htmlFor="faultRecoveryTime24hFactor">故障恢复时间-≤24h系数</Label>
                    <Input
                      id="faultRecoveryTime24hFactor"
                      type="number"
                      step="0.01"
                      value={currentDevice.faultRecoveryTime24hFactor || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, faultRecoveryTime24hFactor: parseFloat(e.target.value) || undefined })}
                      placeholder="1.0"
                    />
                  </div>
                </div>
              </div>

              {/* 第三组：巡检费相关 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">巡检费相关</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inspectionLaborFee">巡检人工费</Label>
                    <Input
                      id="inspectionLaborFee"
                      type="number"
                      step="0.01"
                      value={currentDevice.inspectionLaborFee || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, inspectionLaborFee: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inspectionPersonCount">巡检人数</Label>
                    <Input
                      id="inspectionPersonCount"
                      type="number"
                      value={currentDevice.inspectionPersonCount || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, inspectionPersonCount: parseInt(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inspectionDuration">巡检时长（分钟）</Label>
                    <Input
                      id="inspectionDuration"
                      type="number"
                      value={currentDevice.inspectionDuration || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, inspectionDuration: parseInt(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inspectionTimesPerYear">年基础服务次数</Label>
                    <Input
                      id="inspectionTimesPerYear"
                      type="number"
                      value={currentDevice.inspectionTimesPerYear || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, inspectionTimesPerYear: parseInt(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="inspectionContent">巡检内容</Label>
                    <Input
                      id="inspectionContent"
                      value={currentDevice.inspectionContent || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, inspectionContent: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 第四组：上门费和故障处理费 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">上门费和故障处理费</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="onSiteFeeAnnual">故障上门服务费</Label>
                    <Input
                      id="onSiteFeeAnnual"
                      type="number"
                      step="0.01"
                      value={currentDevice.onSiteFeeAnnual || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, onSiteFeeAnnual: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trafficFee">交通费（元）</Label>
                    <Input
                      id="trafficFee"
                      type="number"
                      step="0.01"
                      value={currentDevice.trafficFee || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, trafficFee: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="faultHandlingFeeTotal">故障处理费</Label>
                    <Input
                      id="faultHandlingFeeTotal"
                      type="number"
                      step="0.01"
                      value={currentDevice.faultHandlingFeeTotal || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, faultHandlingFeeTotal: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inWarranty">是否在保内</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="inWarranty"
                        checked={currentDevice.inWarrantyFactor === 0.5}
                        onCheckedChange={(checked) => setCurrentDevice({ 
                          ...currentDevice, 
                          inWarrantyFactor: checked ? 0.5 : 1 
                        })}
                      />
                      <Label htmlFor="inWarranty">{currentDevice.inWarrantyFactor === 0.5 ? '是' : '否'}</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depreciationLevelDescription">成新率</Label>
                    <select
                      id="depreciationLevelDescription"
                      value={currentDevice.depreciationLevelDescription || ''}
                      onChange={(e) => setCurrentDevice({ 
                        ...currentDevice, 
                        depreciationLevelDescription: e.target.value as DepreciationLevel 
                      })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="">请选择</option>
                      {DEPRECIATION_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 第五组：工具仪表与耗材 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">工具仪表与耗材</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="toolAmortization">工具仪表摊销（元）</Label>
                    <Input
                      id="toolAmortization"
                      type="number"
                      step="0.01"
                      value={currentDevice.toolAmortization || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, toolAmortization: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="consumableFee">耗材费</Label>
                    <Input
                      id="consumableFee"
                      type="number"
                      step="0.01"
                      value={currentDevice.consumableFee || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, consumableFee: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toolDetails">维保涉及工具仪表明细</Label>
                    <Input
                      id="toolDetails"
                      value={currentDevice.toolDetails || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, toolDetails: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="consumableDetails">耗材明细</Label>
                    <Input
                      id="consumableDetails"
                      value={currentDevice.consumableDetails || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, consumableDetails: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 第六组：备件相关 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">备件相关</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="needSparePart">是否需要备件</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="needSparePart"
                        checked={currentDevice.needSparePart || false}
                        onCheckedChange={(checked) => setCurrentDevice({ ...currentDevice, needSparePart: checked })}
                      />
                      <Label htmlFor="needSparePart">{currentDevice.needSparePart ? '是' : '否'}</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sparePartReserve">备件风险准备金（元）</Label>
                    <Input
                      id="sparePartReserve"
                      type="number"
                      step="0.01"
                      value={currentDevice.sparePartReserve || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, sparePartReserve: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="sparePartBasis">备件准备金测算依据</Label>
                    <Input
                      id="sparePartBasis"
                      value={currentDevice.sparePartBasis || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, sparePartBasis: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 第七组：报价相关 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">报价相关</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cityPrice">城区报价（元·年）</Label>
                    <Input
                      id="cityPrice"
                      type="number"
                      step="0.01"
                      value={currentDevice.cityPrice || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, cityPrice: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="faultHandlingFeeDetail">其中故障处理费（元·年）</Label>
                    <Input
                      id="faultHandlingFeeDetail"
                      type="number"
                      step="0.01"
                      value={currentDevice.faultHandlingFeeDetail || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, faultHandlingFeeDetail: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urbanPrice">市区县城郊区总价（元/台·年）</Label>
                    <Input
                      id="urbanPrice"
                      type="number"
                      step="0.01"
                      value={currentDevice.urbanPrice || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, urbanPrice: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="townPrice">乡镇总价（元/台·年）</Label>
                    <Input
                      id="townPrice"
                      type="number"
                      step="0.01"
                      value={currentDevice.townPrice || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, townPrice: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ruralPrice">农村总价（元/台·年）</Label>
                    <Input
                      id="ruralPrice"
                      type="number"
                      step="0.01"
                      value={currentDevice.ruralPrice || ''}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, ruralPrice: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractYears">合同年限</Label>
                    <select
                      id="contractYears"
                      value={currentDevice.contractYears}
                      onChange={(e) => setCurrentDevice({ ...currentDevice, contractYears: parseInt(e.target.value) || 1 })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value={1}>1年</option>
                      <option value={2}>2年</option>
                      <option value={3}>3年</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 第八组：维保内容 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">维保内容</h3>
                <div className="space-y-2">
                  <Label htmlFor="coreMaintenanceContent">核心维保内容</Label>
                  <Input
                    id="coreMaintenanceContent"
                    value={currentDevice.coreMaintenanceContent || ''}
                    onChange={(e) => setCurrentDevice({ ...currentDevice, coreMaintenanceContent: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
              <Button type="button" variant="secondary" onClick={() => {
                setCurrentDevice({
                  category: '',
                  name: '',
                  model: '',
                  level: 'B',
                  engineerLevel: '初级',
                  deviceCount: 1,
                  needSparePart: false,
                  contractYears: 1
                });
              }}>
                重置
              </Button>
              <Button type="button" onClick={handleAddDevice}>
                添加设备
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>设备清单</CardTitle>
              <CardDescription>已添加的设备列表</CardDescription>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无设备，请先在"填写表单"标签页添加设备
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>设备分类</TableHead>
                        <TableHead>设备名称</TableHead>
                        <TableHead>规格型号</TableHead>
                        <TableHead>维保分档</TableHead>
                        <TableHead>数量</TableHead>
                        <TableHead>合同年限</TableHead>
                        <TableHead>城区报价</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.map((device, index) => (
                        <TableRow key={index}>
                          <TableCell>{device.category}</TableCell>
                          <TableCell>{device.name}</TableCell>
                          <TableCell>{device.model}</TableCell>
                          <TableCell>{device.level}</TableCell>
                          <TableCell>{device.deviceCount}</TableCell>
                          <TableCell>{device.contractYears}年</TableCell>
                          <TableCell>{device.cityPrice ? `¥${device.cityPrice.toFixed(2)}` : '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveDevice(index)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              删除
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleSubmitImport} size="lg">
                      <Upload className="w-4 h-4 mr-2" />
                      提交审核 ({devices.length}台设备)
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records">
          <Card>
            <CardHeader>
              <CardTitle>导入记录</CardTitle>
              <CardDescription>查看设备清单导入审核状态</CardDescription>
            </CardHeader>
            <CardContent>
              {importRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无导入记录
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>设备名称</TableHead>
                      <TableHead>设备分类</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>合同年限</TableHead>
                      <TableHead>提交人</TableHead>
                      <TableHead>提交时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>审核人</TableHead>
                      <TableHead>审核意见</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.name}</TableCell>
                        <TableCell>{record.category}</TableCell>
                        <TableCell>{record.deviceCount}</TableCell>
                        <TableCell>{record.contractYears}年</TableCell>
                        <TableCell>{record.submittedBy}</TableCell>
                        <TableCell>{record.submittedAt.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell>{record.reviewedBy || '-'}</TableCell>
                        <TableCell>{record.reviewComment || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
