'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, FileDown, Eye, FileSpreadsheet } from 'lucide-react';
import {
  generateEngineeringQuoteHTML,
  downloadAsWord,
  convertToChineseCurrency,
  type EngineeringQuoteExportData,
} from '@/lib/export-utils';
import {
  SELF_CONSTRUCTION_QUOTA,
  INTELLIGENT_PROJECT_QUOTA,
  type SelfConstructionItem,
  type IntelligentItem,
} from '@/lib/self-construction-quota';

interface QuoteItem {
  id: number;
  itemType: 'selfConstruction' | 'intelligent';
  itemId: string;
  quantity: number;
}

export default function EngineeringPage() {
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [managementFeeRate, setManagementFeeRate] = useState(8);
  const [profitRate, setProfitRate] = useState(10);
  const [regulatoryFeeRate, setRegulatoryFeeRate] = useState(3);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [nextItemId, setNextItemId] = useState(1);
  const quoteRandomRef = useRef(Math.floor(Math.random() * 1000));
  const [activeTab, setActiveTab] = useState('create');

  const addQuoteItem = (itemType: 'selfConstruction' | 'intelligent', itemId: string) => {
    setQuoteItems([...quoteItems, { id: nextItemId, itemType, itemId, quantity: 1 }]);
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

  const getItemById = (itemType: 'selfConstruction' | 'intelligent', itemId: string) => {
    if (itemType === 'selfConstruction') {
      return SELF_CONSTRUCTION_QUOTA.find(item => item.id === itemId);
    } else {
      return INTELLIGENT_PROJECT_QUOTA.find(item => item.id === itemId);
    }
  };

  const calculateTotals = () => {
    let totalBase = 0;

    quoteItems.forEach(item => {
      const quotaItem = getItemById(item.itemType, item.itemId);
      if (quotaItem) {
        totalBase += quotaItem.price * item.quantity;
      }
    });

    const subtotal = totalBase;
    const managementFee = subtotal * (managementFeeRate / 100);
    const profit = subtotal * (profitRate / 100);
    const regulatoryFee = subtotal * (regulatoryFeeRate / 100);
    const taxRate = 0.13;
    const taxAmount = (subtotal + managementFee + profit + regulatoryFee) * taxRate;
    const total = subtotal + managementFee + profit + regulatoryFee + taxAmount;

    return {
      totalBase,
      subtotal,
      managementFee,
      profit,
      regulatoryFee,
      taxAmount,
      total,
    };
  };

  const totals = calculateTotals();

  // 导出工程报价单
  const handleExportEngineeringQuote = () => {
    if (quoteItems.length === 0) return;

    // 生成报价单号
    const quoteNumber = `GC${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(quoteRandomRef.current).padStart(3, '0')}`;

    const exportData: EngineeringQuoteExportData = {
      projectName,
      clientName: customerName,
      contactPerson,
      contactPhone,
      quoteNumber,
      quoteDate: new Date().toISOString().split('T')[0],
      items: quoteItems.map(item => {
        const quotaItem = getItemById(item.itemType, item.itemId);
        if (!quotaItem) return { name: '', unit: '', quantity: 0, unitPrice: 0, amount: 0 };
        const unitPrice = quotaItem.price * (1 + managementFeeRate / 100 + profitRate / 100 + regulatoryFeeRate / 100);
        return {
          name: quotaItem.name,
          unit: quotaItem.unit,
          quantity: item.quantity,
          unitPrice: unitPrice,
          amount: unitPrice * item.quantity,
        };
      }).filter(item => item.name),
      rates: {
        managementRate: managementFeeRate,
        profitRate: profitRate,
        regulatoryRate: regulatoryFeeRate,
        taxRate: 13,
      },
      summary: {
        subtotal: totals.subtotal,
        managementFee: totals.managementFee,
        profit: totals.profit,
        regulatoryFee: totals.regulatoryFee,
        tax: totals.taxAmount,
        grandTotal: totals.total,
        grandTotalRMB: convertToChineseCurrency(totals.total),
      },
    };

    const html = generateEngineeringQuoteHTML(exportData);
    downloadAsWord(html, `工程报价单_${quoteNumber}.doc`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">工程报价</h1>
          <p className="text-muted-foreground mt-1">创建和管理工程报价单</p>
        </div>
      </div>

      <Tabs defaultValue="create" className="w-full" value={activeTab} onValueChange={setActiveTab}>
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
              <div className="space-y-2">
                <Label htmlFor="contactPerson">联系人</Label>
                <Input
                  id="contactPerson"
                  placeholder="请输入联系人"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">联系电话</Label>
                <Input
                  id="contactPhone"
                  placeholder="请输入联系电话"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
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
                <div className="flex gap-2">
                  <Select onValueChange={(value) => addQuoteItem('selfConstruction', value)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="添加自施工工序" />
                    </SelectTrigger>
                    <SelectContent>
                      {SELF_CONSTRUCTION_QUOTA.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select onValueChange={(value) => addQuoteItem('intelligent', value)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="添加智能化项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTELLIGENT_PROJECT_QUOTA.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">操作</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>定额名称</TableHead>
                    <TableHead className="w-[100px]">单位</TableHead>
                    <TableHead className="w-[120px]">数量</TableHead>
                    <TableHead className="w-[120px]">单价</TableHead>
                    <TableHead className="w-[120px]">小计</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quoteItems.map((item) => {
                    const quotaItem = getItemById(item.itemType, item.itemId);
                    if (!quotaItem) return null;
                    const baseFee = quotaItem.price * item.quantity;
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
                        <TableCell>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.itemType === 'selfConstruction' ? '自施工' : '智能化'}
                          </span>
                        </TableCell>
                        <TableCell>{quotaItem.name}</TableCell>
                        <TableCell>{quotaItem.unit}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>¥{quotaItem.price.toFixed(2)}</TableCell>
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
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">定额费合计</p>
                  <p className="text-xl font-semibold">¥{totals.totalBase.toFixed(2)}</p>
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
              <Button variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                导出PDF
              </Button>
              <Button 
                className="bg-green-700 hover:bg-green-800"
                onClick={handleExportEngineeringQuote}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                导出Word
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="quotas" className="mt-6 space-y-6">
          {/* 自施工工序定额 */}
          <Card>
            <CardHeader>
              <CardTitle>自施工工序定额</CardTitle>
              <CardDescription>宽带、专线项目和常规内部布线施工工序</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>定额名称</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead>单价</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SELF_CONSTRUCTION_QUOTA.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.category}
                        </span>
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>¥{item.price.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{item.remark || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 集成商智能化项目报价 */}
          <Card>
            <CardHeader>
              <CardTitle>集成商智能化项目报价</CardTitle>
              <CardDescription>设备和施工安装项目报价</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>定额名称</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead>单价</TableHead>
                    <TableHead>可抵扣税率</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {INTELLIGENT_PROJECT_QUOTA.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {item.category}
                        </span>
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>¥{item.price.toFixed(2)}</TableCell>
                      <TableCell>{item.deductibleTaxRate}%</TableCell>
                      <TableCell className="text-muted-foreground">{item.remark || '-'}</TableCell>
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
