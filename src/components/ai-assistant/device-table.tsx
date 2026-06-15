'use client';

import { useState, useMemo } from 'react';
import { Trash2, Plus, Merge, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { mergeDevices, type AIDevice } from '@/hooks/use-ai-assistant';
import { toast } from 'sonner';

const DEVICE_TYPES = [
  '台式电脑', '笔记本电脑', '打印机', '复印机',
  '扫描仪', '装订机', '服务器', '网络设备', '监控设备', '其他',
];

interface DeviceTableProps {
  devices: AIDevice[];
  onChange: (devices: AIDevice[]) => void;
  className?: string;
}

export function DeviceTable({ devices, onChange, className }: DeviceTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDevice, setEditingDevice] = useState<AIDevice | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const totalQuantity = useMemo(
    () => devices.reduce((sum, d) => sum + (d.quantity || 0), 0),
    [devices]
  );

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingDevice({ ...devices[index] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingDevice(null);
  };

  const saveEdit = () => {
    if (editingIndex === null || !editingDevice) return;
    const newDevices = [...devices];
    newDevices[editingIndex] = editingDevice;
    onChange(newDevices);
    cancelEdit();
    toast.success('已保存修改');
  };

  const handleDelete = (index: number) => {
    const newDevices = devices.filter((_, i) => i !== index);
    onChange(newDevices);
    toast.success('已删除设备');
  };

  const handleAddNew = () => {
    onChange([
      ...devices,
      {
        deviceName: '台式电脑',
        quantity: 1,
        useYears: 2,
        underWarranty: false,
        needSpareParts: false,
        rawText: '手动添加',
      },
    ]);
  };

  const handleMergeSelected = () => {
    if (selectedIndices.size < 2) {
      toast.warning('请至少选择2个设备进行合并');
      return;
    }

    const toMerge = devices.filter((_, i) => selectedIndices.has(i));
    const merged = mergeDevices(toMerge);
    const remaining = devices.filter((_, i) => !selectedIndices.has(i));

    // 只保留第一个合并结果
    onChange([...remaining, merged[0]]);
    setSelectedIndices(new Set());
    toast.success(`已合并 ${toMerge.length} 个设备`);
  };

  const toggleSelect = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === devices.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(devices.map((_, i) => i)));
    }
  };

  if (devices.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        暂无设备，请添加或AI识别
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-1" /> 手动添加设备
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>共 <strong className="text-blue-600">{devices.length}</strong> 种设备</span>
          <span>·</span>
          <span>合计 <strong className="text-blue-600">{totalQuantity}</strong> 台</span>
          {selectedIndices.size > 0 && (
            <Badge variant="secondary">已选 {selectedIndices.size}</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {selectedIndices.size >= 2 && (
            <Button variant="outline" size="sm" onClick={handleMergeSelected}>
              <Merge className="h-4 w-4 mr-1" /> 合并所选
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-1" /> 添加
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 p-2">
                <Checkbox
                  checked={selectedIndices.size === devices.length && devices.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th className="text-left p-2 font-medium">设备类型</th>
              <th className="text-left p-2 font-medium w-24">数量</th>
              <th className="text-left p-2 font-medium w-24">使用年限</th>
              <th className="text-left p-2 font-medium w-24">保修</th>
              <th className="text-left p-2 font-medium w-24">备件</th>
              <th className="text-left p-2 font-medium">置信度</th>
              <th className="w-24 p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device, index) => {
              if (editingIndex === index && editingDevice) {
                return (
                  <tr key={index} className="border-t bg-blue-50">
                    <td className="p-2"><Checkbox checked={selectedIndices.has(index)} onCheckedChange={() => toggleSelect(index)} /></td>
                    <td className="p-2">
                      <Select
                        value={editingDevice.deviceName}
                        onValueChange={(v) => setEditingDevice({ ...editingDevice, deviceName: v })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEVICE_TYPES.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="1"
                        value={editingDevice.quantity}
                        onChange={(e) => setEditingDevice({ ...editingDevice, quantity: parseInt(e.target.value) || 1 })}
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        value={editingDevice.useYears || 0}
                        onChange={(e) => setEditingDevice({ ...editingDevice, useYears: parseInt(e.target.value) || 0 })}
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="p-2">
                      <Checkbox
                        checked={editingDevice.underWarranty || false}
                        onCheckedChange={(c) => setEditingDevice({ ...editingDevice, underWarranty: !!c })}
                      />
                    </td>
                    <td className="p-2">
                      <Checkbox
                        checked={editingDevice.needSpareParts || false}
                        onCheckedChange={(c) => setEditingDevice({ ...editingDevice, needSpareParts: !!c })}
                      />
                    </td>
                    <td className="p-2 text-xs text-gray-500">编辑中</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={saveEdit} className="h-7 w-7 text-green-600">
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-7 w-7 text-red-600">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={index} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <Checkbox
                      checked={selectedIndices.has(index)}
                      onCheckedChange={() => toggleSelect(index)}
                    />
                  </td>
                  <td className="p-2 font-medium">
                    {device.deviceName}
                    {device.warnings && device.warnings.length > 0 && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        {device.warnings.length}个警告
                      </Badge>
                    )}
                  </td>
                  <td className="p-2">{device.quantity}</td>
                  <td className="p-2">{device.useYears || '-'}</td>
                  <td className="p-2">
                    {device.underWarranty ? (
                      <Badge className="bg-green-100 text-green-700 text-xs">在保</Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-2">
                    {device.needSpareParts ? (
                      <Badge className="bg-blue-100 text-blue-700 text-xs">需要</Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-2">
                    {device.confidence !== undefined ? (
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${device.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(device.confidence * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(index)}
                        className="h-7 w-7"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(index)}
                        className="h-7 w-7 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
