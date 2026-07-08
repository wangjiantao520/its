'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, Edit, Trash2, Save, X, Search, 
  Cpu, Wrench, Building2, Users, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';

// 设备定额类型
interface DeviceQuota {
  id: number;
  category: string;
  name: string;
  brand: string;
  model: string;
  specification: string;
  maintenance_tier: string;
  annual_fault_count: number;
  a_gear_fault_count: number;
  b_gear_fault_count: number;
  c_gear_fault_count: number;
  d_gear_fault_count: number;
  e_gear_fault_count: number;
  fault_processing_days: number;
  inspection_days: number;
  on_site_count: number;
}

// 自施工工序定额
interface SelfConstructionQuota {
  id: string;
  category: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  remark: string;
  sort_order: number;
}

// 集成商智能化项目定额
interface IntelligentProjectQuota {
  id: string;
  serial_number: number;
  category: string;
  name: string;
  brand_model: string;
  description: string;
  deductible_tax_rate: number;
  unit: string;
  price: number;
  remark: string;
  sort_order: number;
}

// 人工单价配置
interface LaborPriceConfig {
  id: number;
  level: string;
  unit_price: number;
  unit: string;
  description: string;
  sort_order: number;
  is_active: number;
}

export default function DatabasePage() {
  const [activeTab, setActiveTab] = useState('device_quotas');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 数据状态
  const [deviceQuotas, setDeviceQuotas] = useState<DeviceQuota[]>([]);
  const [selfConstructionQuotas, setSelfConstructionQuotas] = useState<SelfConstructionQuota[]>([]);
  const [intelligentProjectQuotas, setIntelligentProjectQuotas] = useState<IntelligentProjectQuota[]>([]);
  const [laborPriceConfigs, setLaborPriceConfigs] = useState<LaborPriceConfig[]>([]);
  
  // 编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // 二级密码确认对话框
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmError, setConfirmError] = useState('');
  
  // 操作反馈
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/device-params');
      const result = await response.json();
      
      if (result.success) {
        setDeviceQuotas(result.data.device_quotas || []);
        setSelfConstructionQuotas(result.data.self_construction_quotas || []);
        setIntelligentProjectQuotas(result.data.intelligent_project_quotas || []);
        setLaborPriceConfigs(result.data.labor_price_config || []);
      }
    } catch (error) {
      showMessage('error', '加载数据失败: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 打开编辑对话框
  const handleEdit = (item: any) => {
    setEditingItem({ ...item });
    setIsAdding(false);
    setEditDialogOpen(true);
  };

  // 打开新增对话框
  const handleAdd = () => {
    const newItem = getEmptyItem(activeTab);
    setEditingItem(newItem);
    setIsAdding(true);
    setEditDialogOpen(true);
  };

  const getEmptyItem = (type: string) => {
    switch (type) {
      case 'device_quotas':
        return {
          category: '', name: '', brand: '', model: '', specification: '',
          maintenance_tier: 'C档', annual_fault_count: 0, a_gear_fault_count: 0,
          b_gear_fault_count: 0, c_gear_fault_count: 0, d_gear_fault_count: 0,
          e_gear_fault_count: 0, fault_processing_days: 0, inspection_days: 0, on_site_count: 0
        };
      case 'self_construction_quotas':
        return { id: '', category: '', name: '', unit: '', quantity: 1, price: 0, remark: '', sort_order: 0 };
      case 'intelligent_project_quotas':
        return { id: '', serial_number: 0, category: '', name: '', brand_model: '', description: '', deductible_tax_rate: 0, unit: '', price: 0, remark: '', sort_order: 0 };
      case 'labor_price_config':
        return { level: '', unit_price: 0, unit: '人天', description: '', sort_order: 0, is_active: 1 };
      default:
        return {};
    }
  };

  // 保存前需要二级密码确认
  const handleSave = async () => {
    setConfirmError('');
    setConfirmPassword('');
    setPendingAction(() => async () => {
      await doSave();
    });
    setConfirmDialogOpen(true);
  };

  const doSave = async () => {
    try {
      const url = isAdding ? '/api/device-params' : `/api/device-params/${editingItem.id}`;
      const method = isAdding ? 'POST' : 'PUT';
      
      const body = isAdding 
        ? { type: activeTab, data: editingItem }
        : { type: activeTab, id: editingItem.id, data: editingItem };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (result.success) {
        showMessage('success', isAdding ? '添加成功' : '更新成功');
        setEditDialogOpen(false);
        loadData();
      } else {
        showMessage('error', result.message || '操作失败');
      }
    } catch (error) {
      showMessage('error', '操作失败: ' + String(error));
    }
  };

  // 删除前需要二级密码确认
  const handleDelete = (id: string | number) => {
    setConfirmError('');
    setConfirmPassword('');
    setPendingAction(() => async () => {
      await doDelete(id);
    });
    setConfirmDialogOpen(true);
  };

  const doDelete = async (id: string | number) => {
    try {
      const response = await fetch(`/api/device-params/${id}?type=${activeTab}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        showMessage('success', '删除成功');
        loadData();
      } else {
        showMessage('error', result.message || '删除失败');
      }
    } catch (error) {
      showMessage('error', '删除失败: ' + String(error));
    }
  };

  // 确认密码验证
  const handleConfirm = async () => {
    // 验证二级密码（这里使用简单的固定密码，实际应该从后端验证）
    if (confirmPassword !== 'admin123') {
      setConfirmError('密码错误，请输入正确的管理密码');
      return;
    }
    
    setConfirmDialogOpen(false);
    if (pendingAction) {
      await pendingAction();
    }
  };

  // 过滤数据
  const filterData = <T extends Record<string, any>>(data: T[]): T[] => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(term)
      )
    );
  };

  // 更新编辑项的字段
  const updateEditingItem = (field: string, value: any) => {
    setEditingItem({ ...editingItem, [field]: value });
  };

  // 渲染编辑表单
  const renderEditForm = () => {
    if (!editingItem) return null;

    switch (activeTab) {
      case 'device_quotas':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>设备类别</Label>
              <Input value={editingItem.category} onChange={(e) => updateEditingItem('category', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>设备名称</Label>
              <Input value={editingItem.name} onChange={(e) => updateEditingItem('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>品牌</Label>
              <Input value={editingItem.brand} onChange={(e) => updateEditingItem('brand', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>型号</Label>
              <Input value={editingItem.model} onChange={(e) => updateEditingItem('model', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>规格</Label>
              <Input value={editingItem.specification} onChange={(e) => updateEditingItem('specification', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>维保档次</Label>
              <Input value={editingItem.maintenance_tier} onChange={(e) => updateEditingItem('maintenance_tier', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>年故障次数</Label>
              <Input type="number" value={editingItem.annual_fault_count} onChange={(e) => updateEditingItem('annual_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>A档故障次数</Label>
              <Input type="number" value={editingItem.a_gear_fault_count} onChange={(e) => updateEditingItem('a_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>B档故障次数</Label>
              <Input type="number" value={editingItem.b_gear_fault_count} onChange={(e) => updateEditingItem('b_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>C档故障次数</Label>
              <Input type="number" value={editingItem.c_gear_fault_count} onChange={(e) => updateEditingItem('c_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>D档故障次数</Label>
              <Input type="number" value={editingItem.d_gear_fault_count} onChange={(e) => updateEditingItem('d_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>E档故障次数</Label>
              <Input type="number" value={editingItem.e_gear_fault_count} onChange={(e) => updateEditingItem('e_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>故障处理天数</Label>
              <Input type="number" value={editingItem.fault_processing_days} onChange={(e) => updateEditingItem('fault_processing_days', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>巡检天数</Label>
              <Input type="number" value={editingItem.inspection_days} onChange={(e) => updateEditingItem('inspection_days', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>到场次数</Label>
              <Input type="number" value={editingItem.on_site_count} onChange={(e) => updateEditingItem('on_site_count', parseInt(e.target.value))} />
            </div>
          </div>
        );

      case 'self_construction_quotas':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>工序ID</Label>
              <Input value={editingItem.id} onChange={(e) => updateEditingItem('id', e.target.value)} disabled={!isAdding} />
            </div>
            <div className="space-y-2">
              <Label>类别</Label>
              <Input value={editingItem.category} onChange={(e) => updateEditingItem('category', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>工序名称</Label>
              <Input value={editingItem.name} onChange={(e) => updateEditingItem('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>单位</Label>
              <Input value={editingItem.unit} onChange={(e) => updateEditingItem('unit', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>数量</Label>
              <Input type="number" value={editingItem.quantity} onChange={(e) => updateEditingItem('quantity', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>单价</Label>
              <Input type="number" value={editingItem.price} onChange={(e) => updateEditingItem('price', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input type="number" value={editingItem.sort_order} onChange={(e) => updateEditingItem('sort_order', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>备注</Label>
              <Input value={editingItem.remark} onChange={(e) => updateEditingItem('remark', e.target.value)} />
            </div>
          </div>
        );

      case 'intelligent_project_quotas':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>项目ID</Label>
              <Input value={editingItem.id} onChange={(e) => updateEditingItem('id', e.target.value)} disabled={!isAdding} />
            </div>
            <div className="space-y-2">
              <Label>序号</Label>
              <Input type="number" value={editingItem.serial_number} onChange={(e) => updateEditingItem('serial_number', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>类别</Label>
              <Input value={editingItem.category} onChange={(e) => updateEditingItem('category', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>项目名称</Label>
              <Input value={editingItem.name} onChange={(e) => updateEditingItem('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>品牌型号</Label>
              <Input value={editingItem.brand_model} onChange={(e) => updateEditingItem('brand_model', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>单位</Label>
              <Input value={editingItem.unit} onChange={(e) => updateEditingItem('unit', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>单价</Label>
              <Input type="number" value={editingItem.price} onChange={(e) => updateEditingItem('price', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>可抵扣税率(%)</Label>
              <Input type="number" value={editingItem.deductible_tax_rate} onChange={(e) => updateEditingItem('deductible_tax_rate', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input type="number" value={editingItem.sort_order} onChange={(e) => updateEditingItem('sort_order', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>描述</Label>
              <Input value={editingItem.description} onChange={(e) => updateEditingItem('description', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>备注</Label>
              <Input value={editingItem.remark} onChange={(e) => updateEditingItem('remark', e.target.value)} />
            </div>
          </div>
        );

      case 'labor_price_config':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>等级</Label>
              <Input value={editingItem.level} onChange={(e) => updateEditingItem('level', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>单价</Label>
              <Input type="number" value={editingItem.unit_price} onChange={(e) => updateEditingItem('unit_price', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>单位</Label>
              <Input value={editingItem.unit} onChange={(e) => updateEditingItem('unit', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input type="number" value={editingItem.sort_order} onChange={(e) => updateEditingItem('sort_order', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>是否启用</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editingItem.is_active} 
                onChange={(e) => updateEditingItem('is_active', parseInt(e.target.value))}
              >
                <option value={1}>启用</option>
                <option value={0}>禁用</option>
              </select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>描述</Label>
              <Input value={editingItem.description} onChange={(e) => updateEditingItem('description', e.target.value)} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // 获取当前数据
  const getCurrentData = () => {
    switch (activeTab) {
      case 'device_quotas': return filterData(deviceQuotas);
      case 'self_construction_quotas': return filterData(selfConstructionQuotas);
      case 'intelligent_project_quotas': return filterData(intelligentProjectQuotas);
      case 'labor_price_config': return filterData(laborPriceConfigs);
      default: return [];
    }
  };

  // 渲染表格
  const renderTable = () => {
    const data = getCurrentData();

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600">加载中...</span>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          {searchTerm ? '没有找到匹配的数据' : '暂无数据，点击"新增"按钮添加'}
        </div>
      );
    }

    switch (activeTab) {
      case 'device_quotas':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类别</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>品牌</TableHead>
                <TableHead>型号</TableHead>
                <TableHead>维保档次</TableHead>
                <TableHead className="text-right">年故障次数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data as DeviceQuota[]).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.brand}</TableCell>
                  <TableCell>{item.model}</TableCell>
                  <TableCell>{item.maintenance_tier}</TableCell>
                  <TableCell className="text-right">{item.annual_fault_count}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'self_construction_quotas':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>类别</TableHead>
                <TableHead>工序名称</TableHead>
                <TableHead>单位</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data as SelfConstructionQuota[]).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">¥{item.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'intelligent_project_quotas':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>序号</TableHead>
                <TableHead>类别</TableHead>
                <TableHead>项目名称</TableHead>
                <TableHead>品牌型号</TableHead>
                <TableHead>单位</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data as IntelligentProjectQuota[]).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell>{item.serial_number}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.brand_model}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">¥{item.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'labor_price_config':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>等级</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>单位</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data as LaborPriceConfig[]).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.level}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">¥{item.unit_price.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.is_active ? '启用' : '禁用'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">设备参数管理</h1>
          <p className="text-slate-600 mt-1">管理系统中所有设备参数、定额系数和价格配置</p>
        </div>
        <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          新增
        </Button>
      </div>

      {message && (
        <Alert className={message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="device_quotas">
            <Cpu className="w-4 h-4 mr-2" />
            设备定额
          </TabsTrigger>
          <TabsTrigger value="self_construction_quotas">
            <Wrench className="w-4 h-4 mr-2" />
            自施工工序
          </TabsTrigger>
          <TabsTrigger value="intelligent_project_quotas">
            <Building2 className="w-4 h-4 mr-2" />
            智能化项目
          </TabsTrigger>
          <TabsTrigger value="labor_price_config">
            <Users className="w-4 h-4 mr-2" />
            人工单价
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-slate-500">
              共 {getCurrentData().length} 条记录
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              {renderTable()}
            </CardContent>
          </Card>
        </div>
      </Tabs>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAdding ? '新增' : '编辑'}</DialogTitle>
            <DialogDescription>
              {isAdding ? '添加新的参数记录' : '修改参数记录，保存后需要二级密码确认'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {renderEditForm()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 二级密码确认对话框 */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              安全确认
            </DialogTitle>
            <DialogDescription>
              此操作需要二级密码确认，请输入管理密码
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>管理密码</Label>
              <Input
                type="password"
                placeholder="请输入管理密码"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                autoFocus
              />
              {confirmError && (
                <p className="text-sm text-red-600 mt-1">{confirmError}</p>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                提示：默认管理密码为 <code className="bg-amber-100 px-1 rounded">admin123</code>，建议部署后修改
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirm} className="bg-amber-600 hover:bg-amber-700">
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
