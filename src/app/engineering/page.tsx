'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, FileDown, Eye } from 'lucide-react';

// 模拟定额数据
const mockQuotas = [
  { id: 1, code: 'GD-001', name: '布放网线（走桥架）', category: '布线', unit: '米', laborHours: 0.05, laborCost: 10, materialCost: 3, machineryCost: 0, managementFeeRate: 0.08, profitRate: 0.1, regulatoryFeeRate: 0.03 },
  { id: 2, code: 'GD-002', name: '布放网线（套管埋地）', category: '布线', unit: '米', laborHours: 0.1, laborCost: 20, materialCost: 5, machineryCost: 0, managementFeeRate: 0.08, profitRate: 0.1, regulatoryFeeRate: 0.03 },
  { id: 3, code: 'AZ-001', name: '安装交换机（普通）', category: '安装', unit: '台', laborHours: 0.5, laborCost: 100, materialCost: 20, machineryCost: 0, managementFeeRate: 0.08, profitRate: 0.1, regulatoryFeeRate: 0.03 },
  { id: 4, code: 'AZ-002', name: '安装交换机（配置型）', category: '安装', unit: '台', laborHours: 1, laborCost: 200, materialCost: 30, machineryCost: 0, managementFeeRate: 0.08, profitRate: 0.1, regulatoryFeeRate: 0.03 },
  { id: 5, code: 'AZ-003', name: '安装摄像头（枪机）', category: '安装', unit: '台', laborHours: 0.8, laborCost: 160, materialCost: 50, machineryCost: 0, managementFeeRate: 0.08, profitRate: 0.1, regulatoryFeeRate: 0.03 },
  { id: 6, code: 'AZ-004', name: '安装摄像头（半球）', category: '安装', unit: '台', laborHours: 0.6, laborCost: 120, materialCost: 40, machineryCost: 0, managementFeeRate: 0.08, profitRate: 0.1, regulatoryFeeRate: 0.03 },
];

interface QuoteItem {
  id: number;
  quotaId: number;
  quantity: number;
}

export default function EngineeringPage() {
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [managementFeeRate, setManagementFeeRate] = useState(8);
  const [profitRate, setProfitRate] = useState(10);
  const [regulatoryFeeRate, setRegulatoryFeeRate] = useState(3);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [nextItemId, setNextItemId] = useState(1);

  const addQuoteItem = (quotaId: number) => {
    setQuoteItems([...quoteItems, { id: nextItemId, quotaId, quantity: 1 }]);
    setNextItemId(nextItemId + 1);
  };

  const removeQuoteItem = (itemId: number) => {
    setQuoteItems(quoteItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: number, quantity: number) => {
    setQuoteItems(quoteItems.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const calculateTotals = () => {
    let totalLabor = 0;
    let totalMaterial = 0;
    let totalMachinery = 0;

    quoteItems.forEach(item => {
      const quota = mockQuotas.find(q => q.id === item.quotaId);
      if (quota) {
        totalLabor += quota.laborCost * item.quantity;
        totalMaterial += quota.materialCost * item.quantity;
        totalMachinery += quota.machineryCost * item.quantity;
      }
    });

    const subtotal = totalLabor + totalMaterial + totalMachinery;
    const managementFee = subtotal * (managementFeeRate / 100);
    const profit = subtotal * (profitRate / 100);
    const regulatoryFee = subtotal * (regulatoryFeeRate / 100);
    const taxRate = 0.13;
    const taxAmount = (subtotal + managementFee + profit + regulatoryFee) * taxRate;
    const total = subtotal + managementFee + profit + regulatoryFee + taxAmount;

    return {
      totalLabor,
      totalMaterial,
      totalMachinery,
      subtotal,
      managementFee,
      profit,
      regulatoryFee,
      taxAmount,
      total,
    };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">工程报价</h1>
          <p className="text-muted-foreground mt-1">创建和管理工程报价单</p>
        </div>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList>
          <TabsTrigger value="create">新建报价</TabsTrigger>
          <TabsTrigger value="quotas">定额库管理</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6 mt-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>填写客户和项目基本信息</CardDescription>
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
                <Label htmlFor="projectName">项目名称</Label>
                <Input
                  id="projectName"
                  placeholder="请输入项目名称"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 报价明细 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>报价明细</CardTitle>
                  <CardDescription>添加工序和数量</CardDescription>
                </div>
                <Select onValueChange={(value) => addQuoteItem(parseInt(value))}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="添加定额" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockQuotas.map((quota) => (
                      <SelectItem key={quota.id} value={quota.id.toString()}>
                        {quota.name}
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
                    <TableHead>定额名称</TableHead>
                    <TableHead className="w-[100px]">单位</TableHead>
                    <TableHead className="w-[120px]">数量</TableHead>
                    <TableHead className="w-[120px]">人工费</TableHead>
                    <TableHead className="w-[120px]">材料费</TableHead>
                    <TableHead className="w-[120px]">小计</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quoteItems.map((item) => {
                    const quota = mockQuotas.find(q => q.id === item.quotaId);
                    if (!quota) return null;
                    const laborFee = quota.laborCost * item.quantity;
                    const materialFee = quota.materialCost * item.quantity;
                    const machineryFee = quota.machineryCost * item.quantity;
                    const baseFee = laborFee + materialFee + machineryFee;
                    const subtotal = baseFee * (1 + managementFeeRate / 100 + profitRate / 100 + regulatoryFeeRate / 100);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQuoteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                        <TableCell>{quota.name}</TableCell>
                        <TableCell>{quota.unit}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>¥{laborFee.toFixed(2)}</TableCell>
                        <TableCell>¥{materialFee.toFixed(2)}</TableCell>
                        <TableCell>¥{subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 费率配置 */}
          <Card>
            <CardHeader>
              <CardTitle>费率配置</CardTitle>
              <CardDescription>设置管理费率、利润率和规费率</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="managementFeeRate">管理费率 (%)</Label>
                <Input
                  id="managementFeeRate"
                  type="number"
                  value={managementFeeRate}
                  onChange={(e) => setManagementFeeRate(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profitRate">利润率 (%)</Label>
                <Input
                  id="profitRate"
                  type="number"
                  value={profitRate}
                  onChange={(e) => setProfitRate(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regulatoryFeeRate">规费率 (%)</Label>
                <Input
                  id="regulatoryFeeRate"
                  type="number"
                  value={regulatoryFeeRate}
                  onChange={(e) => setRegulatoryFeeRate(parseFloat(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 汇总计算 */}
          <Card>
            <CardHeader>
              <CardTitle>报价汇总</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">人工费合计</p>
                  <p className="text-xl font-semibold">¥{totals.totalLabor.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">材料费合计</p>
                  <p className="text-xl font-semibold">¥{totals.totalMaterial.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">机械费合计</p>
                  <p className="text-xl font-semibold">¥{totals.totalMachinery.toFixed(2)}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">小计</p>
                  <p className="text-lg font-semibold">¥{totals.subtotal.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">管理费</p>
                  <p className="text-lg font-semibold">¥{totals.managementFee.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">利润</p>
                  <p className="text-lg font-semibold">¥{totals.profit.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">规费</p>
                  <p className="text-lg font-semibold">¥{totals.regulatoryFee.toFixed(2)}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">税额 (13%)</p>
                    <p className="text-lg">¥{totals.taxAmount.toFixed(2)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">总价</p>
                    <p className="text-3xl font-bold text-primary">¥{totals.total.toFixed(2)}</p>
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

        <TabsContent value="quotas" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>定额库管理</CardTitle>
                  <CardDescription>管理工程定额数据</CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新增定额
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>定额编号</TableHead>
                    <TableHead>定额名称</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead>人工费</TableHead>
                    <TableHead>材料费</TableHead>
                    <TableHead>机械费</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockQuotas.map((quota) => (
                    <TableRow key={quota.id}>
                      <TableCell>{quota.code}</TableCell>
                      <TableCell>{quota.name}</TableCell>
                      <TableCell>{quota.category}</TableCell>
                      <TableCell>{quota.unit}</TableCell>
                      <TableCell>¥{quota.laborCost.toFixed(2)}</TableCell>
                      <TableCell>¥{quota.materialCost.toFixed(2)}</TableCell>
                      <TableCell>¥{quota.machineryCost.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
