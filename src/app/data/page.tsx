'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Upload } from 'lucide-react';

// 模拟设备价格数据
const mockDevicePrices = [
  { id: 1, code: 'SW-001', name: '交换机', brand: '华为', model: 'S5735-L48T4S-A', category: '交换机', unit: '台', costPrice: 7500, marketPrice: 8500, supplier: '华为代理商' },
  { id: 2, code: 'SW-002', name: '交换机', brand: 'H3C', model: 'S5120V3-28P-SI', category: '交换机', unit: '台', costPrice: 3200, marketPrice: 3800, supplier: 'H3C代理商' },
  { id: 3, code: 'CAM-001', name: '监控摄像头', brand: '海康威视', model: 'DS-2CD3T46WD-I3', category: '摄像头', unit: '台', costPrice: 520, marketPrice: 650, supplier: '海康威视代理商' },
  { id: 4, code: 'CAM-002', name: '监控摄像头', brand: '大华', model: 'DH-IPC-HFW4433M-I1', category: '摄像头', unit: '台', costPrice: 480, marketPrice: 580, supplier: '大华代理商' },
  { id: 5, code: 'NVR-001', name: 'NVR', brand: '海康威视', model: 'DS-7916N-R4', category: 'NVR', unit: '台', costPrice: 2600, marketPrice: 3200, supplier: '海康威视代理商' },
  { id: 6, code: 'RT-001', name: '路由器', brand: '华为', model: 'AR611-S', category: '路由器', unit: '台', costPrice: 4200, marketPrice: 5000, supplier: '华为代理商' },
];

// 模拟人工单价配置
const mockLaborPrices = [
  { id: 1, level: '初级', unitPrice: 200, unit: '人天', description: '初级工程师' },
  { id: 2, level: '中级', unitPrice: 300, unit: '人天', description: '中级工程师' },
  { id: 3, level: '高级', unitPrice: 400, unit: '人天', description: '高级工程师' },
  { id: 4, level: '专家', unitPrice: 500, unit: '人天', description: '专家级工程师' },
];

export default function DataPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">数据管理</h1>
        <p className="text-muted-foreground mt-1">管理设备库、人工单价和系统配置</p>
      </div>

      <Tabs defaultValue="devices" className="w-full">
        <TabsList>
          <TabsTrigger value="devices">设备库管理</TabsTrigger>
          <TabsTrigger value="labor">人工单价配置</TabsTrigger>
          <TabsTrigger value="system">系统参数设置</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>设备库管理</CardTitle>
                  <CardDescription>管理常见设备价格信息</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    批量导入
                  </Button>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    新增设备
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备编码</TableHead>
                    <TableHead>设备名称</TableHead>
                    <TableHead>品牌</TableHead>
                    <TableHead>型号</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>成本价</TableHead>
                    <TableHead>市场价格</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockDevicePrices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>{device.code}</TableCell>
                      <TableCell>{device.name}</TableCell>
                      <TableCell>{device.brand}</TableCell>
                      <TableCell>{device.model}</TableCell>
                      <TableCell>{device.category}</TableCell>
                      <TableCell>¥{device.costPrice.toFixed(2)}</TableCell>
                      <TableCell>¥{device.marketPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
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

        <TabsContent value="labor" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>人工单价配置</CardTitle>
                  <CardDescription>管理不同等级人员的单价</CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新增等级
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>人员等级</TableHead>
                    <TableHead>单价</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockLaborPrices.map((labor) => (
                    <TableRow key={labor.id}>
                      <TableCell>{labor.level}</TableCell>
                      <TableCell>¥{labor.unitPrice}</TableCell>
                      <TableCell>{labor.unit}</TableCell>
                      <TableCell>{labor.description}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
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

        <TabsContent value="system" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>系统参数设置</CardTitle>
              <CardDescription>配置系统全局参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">税率配置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>增值税税率（一般纳税人）</span>
                      <span className="font-semibold">13%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>增值税税率（小规模）</span>
                      <span className="font-semibold">6%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">默认费率</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>默认管理费率</span>
                      <span className="font-semibold">8%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>默认利润率</span>
                      <span className="font-semibold">10%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>默认规费率</span>
                      <span className="font-semibold">3%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">维保系数配置</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>设备使用年限区间</TableHead>
                        <TableHead>维保系数</TableHead>
                        <TableHead>说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>0-2年</TableCell>
                        <TableCell>6%</TableCell>
                        <TableCell>新设备</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>2-5年</TableCell>
                        <TableCell>10%</TableCell>
                        <TableCell>中等年限设备</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>5年以上</TableCell>
                        <TableCell>15%</TableCell>
                        <TableCell>老旧设备</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
