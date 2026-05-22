'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2, Save, FileDown, Eye } from 'lucide-react';

// 模拟设备数据
const mockDevices = [
  { id: 1, type: '台式电脑', brand: '联想', model: 'ThinkCentre M90t', originalValue: 4000, maintenanceFactorMin: 0.06, maintenanceFactorMax: 0.15, laborMinutes: 15 },
  { id: 2, type: '笔记本电脑', brand: '戴尔', model: 'Latitude 5420', originalValue: 5000, maintenanceFactorMin: 0.06, maintenanceFactorMax: 0.15, laborMinutes: 20 },
  { id: 3, type: '打印机', brand: '惠普', model: 'LaserJet Pro', originalValue: 2000, maintenanceFactorMin: 0.08, maintenanceFactorMax: 0.12, laborMinutes: 30 },
  { id: 4, type: '交换机', brand: '华为', model: 'S5735-L48T4S-A', originalValue: 8000, maintenanceFactorMin: 0.06, maintenanceFactorMax: 0.10, laborMinutes: 20 },
  { id: 5, type: '监控摄像头', brand: '海康威视', model: 'DS-2CD3T46WD-I3', originalValue: 600, maintenanceFactorMin: 0.10, maintenanceFactorMax: 0.15, laborMinutes: 25 },
  { id: 6, type: 'NVR', brand: '海康威视', model: 'DS-7916N-R4', originalValue: 3000, maintenanceFactorMin: 0.08, maintenanceFactorMax: 0.12, laborMinutes: 20 },
];

// 维保系数配置
const maintenanceFactors = [
  { ageRange: '0-2年', factor: 0.06, description: '新设备，维保系数6%' },
  { ageRange: '2-5年', factor: 0.10, description: '中等年限设备，维保系数10%' },
  { ageRange: '5年以上', factor: 0.15, description: '老旧设备，维保系数15%' },
];

// 人工单价配置
const laborPrices = [
  { level: '初级', unitPrice: 200, unit: '人天' },
  { level: '中级', unitPrice: 300, unit: '人天' },
  { level: '高级', unitPrice: 400, unit: '人天' },
  { level: '专家', unitPrice: 500, unit: '人天' },
];

interface MaintenanceDeviceItem {
  id: number;
  deviceId: number;
  quantity: number;
  ageYears: number;
}

export default function MaintenancePage() {
  const [customerName, setCustomerName] = useState('');
  const [contractYears, setContractYears] = useState(1);
  const [quoteMethod, setQuoteMethod] = useState('factor');
  const [laborLevel, setLaborLevel] = useState('中级');
  const [deviceItems, setDeviceItems] = useState<MaintenanceDeviceItem[]>([]);
  const [nextItemId, setNextItemId] = useState(1);

  const addDeviceItem = (deviceId: number) => {
    setDeviceItems([...deviceItems, { id: nextItemId, deviceId, quantity: 1, ageYears: 2 }]);
    setNextItemId(nextItemId + 1);
  };

  const removeDeviceItem = (itemId: number) => {
    setDeviceItems(deviceItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: number, quantity: number) => {
    setDeviceItems(deviceItems.map(item =>
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const updateAgeYears = (itemId: number, ageYears: number) => {
    setDeviceItems(deviceItems.map(item =>
      item.id === itemId ? { ...item, ageYears } : item
    ));
  };

  const getMaintenanceFactor = (ageYears: number) => {
    if (ageYears <= 2) return 0.06;
    if (ageYears <= 5) return 0.10;
    return 0.15;
  };

  const calculateTotals = () => {
    let totalMaintenanceFee = 0;
    let details: Array<{
      deviceType: string;
      quantity: number;
      originalValue: number;
      ageYears: number;
      factor?: number;
      annualFee: number;
    }> = [];

    deviceItems.forEach((item) => {
      const device = mockDevices.find(d => d.id === item.deviceId);
      if (!device) return;

      const originalValueTotal = device.originalValue * item.quantity;
      const factor = getMaintenanceFactor(item.ageYears);
      const annualFee = quoteMethod === 'factor'
        ? originalValueTotal * factor
        : calculateByHours(device, item.quantity);

      details.push({
        deviceType: device.type,
        quantity: item.quantity,
        originalValue: originalValueTotal,
        ageYears: item.ageYears,
        factor: quoteMethod === 'factor' ? factor : undefined,
        annualFee,
      });

      totalMaintenanceFee += annualFee;
    });

    const taxRate = 0.13;
    const taxAmount = totalMaintenanceFee * taxRate;
    const total = totalMaintenanceFee + taxAmount;

    return {
      details,
      totalMaintenanceFee,
      taxAmount,
      total,
    };
  };

  const calculateByHours = (device: typeof mockDevices[0], quantity: number) => {
    const laborConfig = laborPrices.find(l => l.level === laborLevel);
    if (!laborConfig) return 0;
    const laborPricePerHour = laborConfig.unitPrice / 8;
    const laborHours = (device.laborMinutes * quantity) / 60;
    const laborFee = laborHours * laborPricePerHour;
    const materialFee = laborFee * 0.1;
    return laborFee + materialFee;
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">维保报价</h1>
        <p className="text-muted-foreground mt-1">创建和管理维保报价单</p>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList>
          <TabsTrigger value="create">新建报价</TabsTrigger>
          <TabsTrigger value="config">维保系数配置</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6 mt-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>填写客户和合同基本信息</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
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
                <Label htmlFor="contractYears">合同年限（年）</Label>
                <Input
                  id="contractYears"
                  type="number"
                  value={contractYears}
                  onChange={(e) => setContractYears(parseInt(e.target.value) || 1)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 设备清单 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>设备清单</CardTitle>
                  <CardDescription>添加需要维保的设备</CardDescription>
                </div>
                <Select onValueChange={(value) => addDeviceItem(parseInt(value))}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="添加设备" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockDevices.map((device) => (
                      <SelectItem key={device.id} value={device.id.toString()}>
                        {device.type} - {device.brand} {device.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">操作</TableHead>
                    <TableHead>设备类型</TableHead>
                    <TableHead>品牌</TableHead>
                    <TableHead className="w-[100px]">数量</TableHead>
                    <TableHead className="w-[100px]">使用年限</TableHead>
                    <TableHead className="w-[120px]">原值</TableHead>
                    <TableHead className="w-[120px]">维保费</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deviceItems.map((item) => {
                    const device = mockDevices.find(d => d.id === item.deviceId);
                    if (!device) return null;
                    const originalValueTotal = device.originalValue * item.quantity;
                    const factor = getMaintenanceFactor(item.ageYears);
                    const annualFee = quoteMethod === 'factor'
                      ? originalValueTotal * factor
                      : calculateByHours(device, item.quantity);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDeviceItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                        <TableCell>{device.type}</TableCell>
                        <TableCell>{device.brand}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.ageYears}
                            onChange={(e) => updateAgeYears(item.id, parseFloat(e.target.value) || 0)}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>¥{originalValueTotal.toFixed(2)}</TableCell>
                        <TableCell>¥{annualFee.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 报价方法选择 */}
          <Card>
            <CardHeader>
              <CardTitle>维保报价方法</CardTitle>
              <CardDescription>选择维保报价计算方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                defaultValue={quoteMethod}
                onValueChange={setQuoteMethod}
                className="grid gap-4"
              >
                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="factor" id="factor" />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="factor">比例系数法</Label>
                    <p className="text-sm text-muted-foreground">
                      按设备原值 × 维保系数计算（0-2年6%，2-5年10%，5年以上15%）
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="hours" id="hours" />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="hours">成本核算法</Label>
                    <p className="text-sm text-muted-foreground">
                      按设备维护时长 × 人工单价计算
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {quoteMethod === 'hours' && (
                <div className="space-y-2">
                  <Label htmlFor="laborLevel">人工等级</Label>
                  <Select value={laborLevel} onValueChange={setLaborLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择人工等级" />
                    </SelectTrigger>
                    <SelectContent>
                      {laborPrices.map((labor) => (
                        <SelectItem key={labor.level} value={labor.level}>
                          {labor.level} - ¥{labor.unitPrice}/{labor.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 汇总计算 */}
          <Card>
            <CardHeader>
              <CardTitle>报价汇总</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备类型</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>原值</TableHead>
                    <TableHead>使用年限</TableHead>
                    {quoteMethod === 'factor' && <TableHead>维保系数</TableHead>}
                    <TableHead>年度维保费</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totals.details.map((detail, index) => (
                    <TableRow key={index}>
                      <TableCell>{detail.deviceType}</TableCell>
                      <TableCell>{detail.quantity}</TableCell>
                      <TableCell>¥{detail.originalValue.toFixed(2)}</TableCell>
                      <TableCell>{detail.ageYears}年</TableCell>
                      {quoteMethod === 'factor' && detail.factor && (
                        <TableCell>{(detail.factor * 100).toFixed(0)}%</TableCell>
                      )}
                      <TableCell>¥{detail.annualFee.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">维保费合计</p>
                    <p className="text-lg">¥{totals.totalMaintenanceFee.toFixed(2)}/年</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">税额 (13%)</p>
                    <p className="text-lg">¥{totals.taxAmount.toFixed(2)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">总价</p>
                    <p className="text-3xl font-bold text-primary">
                      ¥{totals.total.toFixed(2)}/年
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
              <Button variant="outline">
                <Save className="h-4 w-4 mr-2" />
                保存草稿
              </Button>
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                预览报价单
              </Button>
              <Button>
                <FileDown className="h-4 w-4 mr-2" />
                导出PDF
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>维保系数配置</CardTitle>
              <CardDescription>管理设备维保系数和人工单价</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">维保系数配置</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>设备使用年限区间</TableHead>
                      <TableHead>维保系数</TableHead>
                      <TableHead>说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceFactors.map((factor, index) => (
                      <TableRow key={index}>
                        <TableCell>{factor.ageRange}</TableCell>
                        <TableCell>{(factor.factor * 100).toFixed(0)}%</TableCell>
                        <TableCell>{factor.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">人工单价配置</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>人员等级</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {laborPrices.map((labor, index) => (
                      <TableRow key={index}>
                        <TableCell>{labor.level}</TableCell>
                        <TableCell>¥{labor.unitPrice}</TableCell>
                        <TableCell>{labor.unit}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">设备维护时长库</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>设备类型</TableHead>
                      <TableHead>品牌</TableHead>
                      <TableHead>型号</TableHead>
                      <TableHead>标准维护时长</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockDevices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>{device.type}</TableCell>
                        <TableCell>{device.brand}</TableCell>
                        <TableCell>{device.model}</TableCell>
                        <TableCell>{device.laborMinutes}分钟</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
