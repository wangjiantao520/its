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
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react';
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
  const [errors, setErrors] = useState<string[]>([]);
  const [newDevice, setNewDevice] = useState<DeviceFormItem>({
    deviceName: '',
    quantity: 1,
    contractYears: 1,
    needSparePart: false,
    depreciationLevel: '正常',
    inWarranty: false,
  });

  const validateDevice = (device: DeviceFormItem): string[] => {
    const errors: string[] = [];
    
    if (!device.deviceName) {
      errors.push('设备名称不能为空');
    } else {
      const foundDevice = FULL_DEVICE_QUOTAS.find(q => q.name === device.deviceName);
      if (!foundDevice) {
        errors.push(`设备"${device.deviceName}"不在定额库中`);
      }
    }
    
    if (device.quantity < 1) {
      errors.push('数量必须大于0');
    }
    
    if (![1, 2, 3].includes(device.contractYears)) {
      errors.push('合同年限必须是1、2或3年');
    }
    
    return errors;
  };

  const handleAddDevice = () => {
    const validationErrors = validateDevice(newDevice);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setDevices([...devices, { ...newDevice }]);
    setNewDevice({
      deviceName: '',
      quantity: 1,
      contractYears: 1,
      needSparePart: false,
      depreciationLevel: '正常',
      inWarranty: false,
    });
    setErrors([]);
  };

  const handleRemoveDevice = (index: number) => {
    setDevices(devices.filter((_, i) => i !== index));
  };

  const handleSubmitImport = () => {
    if (devices.length === 0) {
      setErrors(['请至少添加一台设备']);
      return;
    }
    
    // 验证所有设备
    const allErrors: string[] = [];
    devices.forEach((device, index) => {
      const deviceErrors = validateDevice(device);
      deviceErrors.forEach(err => {
        allErrors.push(`设备${index + 1}: ${err}`);
      });
    });
    
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }
    
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
    setErrors([]);
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
          <p className="text-muted-foreground mt-1">填写设备清单表格，所有字段都必须填写后提交审核</p>
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
            {errors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">请修正以下错误</span>
                </div>
                <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deviceName">
                  设备名称 <span className="text-red-500">*</span>
                </Label>
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
                <Label htmlFor="quantity">
                  数量 <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="quantity"
                  type="number" 
                  min="1" 
                  value={newDevice.quantity}
                  onChange={(e) => setNewDevice({ ...newDevice, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contractYears">
                  合同年限 <span className="text-red-500">*</span>
                </Label>
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
                <Label htmlFor="needSparePart">
                  需要备件 <span className="text-red-500">*</span>
                </Label>
                <Switch 
                  id="needSparePart"
                  checked={newDevice.needSparePart}
                  onCheckedChange={(checked) => setNewDevice({ ...newDevice, needSparePart: checked })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="depreciationLevel">
                  折旧程度 <span className="text-red-500">*</span>
                </Label>
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
                <Label htmlFor="inWarranty">
                  在保内 <span className="text-red-500">*</span>
                </Label>
                <Switch 
                  id="inWarranty"
                  checked={newDevice.inWarranty}
                  onCheckedChange={(checked) => setNewDevice({ ...newDevice, inWarranty: checked })}
                />
              </div>
            </div>
            
            <Button 
              className="mt-6 bg-blue-700 hover:bg-blue-800" 
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
              <CardTitle>待提交清单 ({devices.length} 台设备)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>序号</TableHead>
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
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{device.deviceName}</TableCell>
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
                className="mt-6 bg-green-700 hover:bg-green-800" 
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
                      <TableCell className="font-medium">{item.deviceName}</TableCell>
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
