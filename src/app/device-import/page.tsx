'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Plus, Trash2, Save } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { addDeviceImport, getDeviceImports, DeviceImportItem, ImportStatus } from '@/lib/roles';
import { FULL_DEVICE_QUOTAS } from '@/lib/complete-device-data';
import type { FullDeviceQuota } from '@/lib/device-quota-full';

interface DeviceFormItem {
  deviceName: string;
  quantity: number;
  contractYears: number;
  needSparePart: boolean;
  depreciationLevel: string;
  inWarranty: boolean;
}

export default function DeviceImportPage() {
  const { user } = useUser();
  const [devices, setDevices] = useState<DeviceFormItem[]>([]);
  const [imports, setImports] = useState<DeviceImportItem[]>(getDeviceImports());
  const [newDevice, setNewDevice] = useState<DeviceFormItem>({
    deviceName: '',
    quantity: 1,
    contractYears: 1,
    needSparePart: false,
    depreciationLevel: '正常',
    inWarranty: false,
  });

  const handleAddDevice = () => {
    if (!newDevice.deviceName) return;
    setDevices([...devices, { ...newDevice }]);
    setNewDevice({
      deviceName: '',
      quantity: 1,
      contractYears: 1,
      needSparePart: false,
      depreciationLevel: '正常',
      inWarranty: false,
    });
  };

  const handleRemoveDevice = (index: number) => {
    setDevices(devices.filter((_, i) => i !== index));
  };

  const handleSubmitImport = () => {
    if (devices.length === 0) return;
    
    devices.forEach(device => {
      addDeviceImport({
        deviceName: device.deviceName,
        quantity: device.quantity,
        contractYears: device.contractYears,
        needSparePart: device.needSparePart,
        depreciationLevel: device.depreciationLevel,
        inWarranty: device.inWarranty,
        submittedBy: user.name,
      });
    });
    
    setDevices([]);
    setImports(getDeviceImports());
  };

  const getStatusBadge = (status: ImportStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">待审核</Badge>;
      case 'approved':
        return <Badge className="bg-green-600">已通过</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600">已拒绝</Badge>;
      default:
        return <Badge>未知</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">设备清单导入</h1>
          <p className="text-muted-foreground mt-1">导入设备清单，提交后需管理员审核</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              添加设备
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>设备名称</Label>
                <Select 
                  value={newDevice.deviceName} 
                  onValueChange={(value) => setNewDevice({ ...newDevice, deviceName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择设备" />
                  </SelectTrigger>
                  <SelectContent>
                    {FULL_DEVICE_QUOTAS.map((quota: FullDeviceQuota) => (
                      <SelectItem key={quota.id} value={quota.name}>
                        {quota.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>数量</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={newDevice.quantity}
                  onChange={(e) => setNewDevice({ ...newDevice, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>合同年限</Label>
                <Select 
                  value={newDevice.contractYears.toString()} 
                  onValueChange={(value) => setNewDevice({ ...newDevice, contractYears: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1年</SelectItem>
                    <SelectItem value="2">2年</SelectItem>
                    <SelectItem value="3">3年</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 flex items-center justify-between">
                <Label>需要备件</Label>
                <Switch 
                  checked={newDevice.needSparePart}
                  onCheckedChange={(checked) => setNewDevice({ ...newDevice, needSparePart: checked })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>折旧程度</Label>
                <Select 
                  value={newDevice.depreciationLevel} 
                  onValueChange={(value) => setNewDevice({ ...newDevice, depreciationLevel: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全新">全新</SelectItem>
                    <SelectItem value="正常">正常</SelectItem>
                    <SelectItem value="较旧">较旧</SelectItem>
                    <SelectItem value="老旧">老旧</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 flex items-center justify-between">
                <Label>在保内</Label>
                <Switch 
                  checked={newDevice.inWarranty}
                  onCheckedChange={(checked) => setNewDevice({ ...newDevice, inWarranty: checked })}
                />
              </div>
            </div>
            
            <Button 
              className="mt-4 bg-blue-700 hover:bg-blue-800" 
              onClick={handleAddDevice}
            >
              <Plus className="h-4 w-4 mr-2" />
              添加到清单
            </Button>
          </CardContent>
        </Card>

        {devices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>待提交清单</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备名称</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>合同年限</TableHead>
                    <TableHead>需要备件</TableHead>
                    <TableHead>折旧程度</TableHead>
                    <TableHead>在保内</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device, index) => (
                    <TableRow key={index}>
                      <TableCell>{device.deviceName}</TableCell>
                      <TableCell>{device.quantity}</TableCell>
                      <TableCell>{device.contractYears}年</TableCell>
                      <TableCell>{device.needSparePart ? '是' : '否'}</TableCell>
                      <TableCell>{device.depreciationLevel}</TableCell>
                      <TableCell>{device.inWarranty ? '是' : '否'}</TableCell>
                      <TableCell>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleRemoveDevice(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <Button 
                className="mt-4 bg-green-700 hover:bg-green-800" 
                onClick={handleSubmitImport}
              >
                <Save className="h-4 w-4 mr-2" />
                提交审核
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>导入记录</CardTitle>
          </CardHeader>
          <CardContent>
            {imports.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">暂无导入记录</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备名称</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>合同年限</TableHead>
                    <TableHead>提交人</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>审核人</TableHead>
                    <TableHead>审核时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.deviceName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.contractYears}年</TableCell>
                      <TableCell>{item.submittedBy}</TableCell>
                      <TableCell>{item.submittedAt.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>{item.reviewedBy || '-'}</TableCell>
                      <TableCell>{item.reviewedAt ? item.reviewedAt.toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
