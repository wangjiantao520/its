'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Upload, Database } from 'lucide-react';

export default function DataPage() {
  const [hasDevices, setHasDevices] = useState(false);

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
              {hasDevices ? (
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
                    {/* 真实数据将从数据库加载 */}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Database className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">暂无设备数据</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    设备库暂无数据，请通过设备清单导入功能添加
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    导入设备
                  </Button>
                </div>
              )}
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
                  {/* 真实数据将从数据库加载 */}
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
