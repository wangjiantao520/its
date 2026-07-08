'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, Edit, Trash2, Save, X, Search, Download, Upload,
  Cpu, Wrench, Building2, Users, AlertCircle, CheckCircle2, Loader2,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

// 设备定额类型
interface DeviceQuota {
  id: number;
  category: string;
  name: string;
  brand: string;
  model: string;
  specification: string;
  maintenance_tier: string;
  level: string;
  engineer_level: string;
  annual_fault_count: number;
  a_gear_fault_count: number;
  b_gear_fault_count: number;
  c_gear_fault_count: number;
  d_gear_fault_count: number;
  e_gear_fault_count: number;
  fault_processing_days: number;
  inspection_days: number;
  on_site_count: number;
  // 金额相关字段
  inspection_labor_fee: number;
  on_site_fee_annual: number;
  traffic_fee: number;
  on_site_connection_labor_fee: number;
  spare_part_reserve: number;
  city_price: number;
  fault_handling_fee_total: number;
  year1_total_price: number;
  year2_total_price: number;
  year3_total_price: number;
  urban_price: number;
  town_price: number;
  rural_price: number;
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

export default function QuotaLibraryPage() {
  const [activeTab, setActiveTab] = useState('device_quotas');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
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
  
  // 展开行状态
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // 导入对话框状态
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  // 切换标签页时重置分类筛选和分页
  useEffect(() => {
    setSelectedCategory('all');
    setExpandedRows(new Set());
    setCurrentPage(1);
  }, [activeTab]);

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
    let filtered = data;
    
    // 按分类筛选
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    // 按搜索词筛选
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        Object.values(item).some(val => 
          String(val).toLowerCase().includes(term)
        )
      );
    }
    
    return filtered;
  };

  // 获取当前标签页的分类列表
  const getCategories = (): string[] => {
    let data: any[] = [];
    switch (activeTab) {
      case 'device_quotas':
        data = deviceQuotas;
        break;
      case 'self_construction_quotas':
        data = selfConstructionQuotas;
        break;
      case 'intelligent_project_quotas':
        data = intelligentProjectQuotas;
        break;
    }
    const categories = [...new Set(data.map(item => item.category).filter(Boolean))];
    return categories.sort();
  };

  // 更新编辑项的字段
  const updateEditingItem = (field: string, value: any) => {
    setEditingItem({ ...editingItem, [field]: value });
  };

  // 渲染编辑表单
  const renderEditForm = () => {
    if (!editingItem) return null;

    // 辅助函数：确保值不为 null
    const safeValue = (val: any, defaultVal: string = ''): string => {
      return val === null || val === undefined ? defaultVal : String(val);
    };

    switch (activeTab) {
      case 'device_quotas':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>设备类别</Label>
              <Input value={safeValue(editingItem.category)} onChange={(e) => updateEditingItem('category', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>设备名称</Label>
              <Input value={safeValue(editingItem.name)} onChange={(e) => updateEditingItem('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>品牌</Label>
              <Input value={safeValue(editingItem.brand)} onChange={(e) => updateEditingItem('brand', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>型号</Label>
              <Input value={safeValue(editingItem.model)} onChange={(e) => updateEditingItem('model', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>规格</Label>
              <Input value={safeValue(editingItem.specification)} onChange={(e) => updateEditingItem('specification', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>维保档次</Label>
              <Input value={safeValue(editingItem.maintenance_tier, 'C档')} onChange={(e) => updateEditingItem('maintenance_tier', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>年故障次数</Label>
              <Input type="number" value={editingItem.annual_fault_count || 0} onChange={(e) => updateEditingItem('annual_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>A档故障次数</Label>
              <Input type="number" value={editingItem.a_gear_fault_count || 0} onChange={(e) => updateEditingItem('a_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>B档故障次数</Label>
              <Input type="number" value={editingItem.b_gear_fault_count || 0} onChange={(e) => updateEditingItem('b_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>C档故障次数</Label>
              <Input type="number" value={editingItem.c_gear_fault_count || 0} onChange={(e) => updateEditingItem('c_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>D档故障次数</Label>
              <Input type="number" value={editingItem.d_gear_fault_count || 0} onChange={(e) => updateEditingItem('d_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>E档故障次数</Label>
              <Input type="number" value={editingItem.e_gear_fault_count || 0} onChange={(e) => updateEditingItem('e_gear_fault_count', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>故障处理天数</Label>
              <Input type="number" value={editingItem.fault_processing_days || 0} onChange={(e) => updateEditingItem('fault_processing_days', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>巡检天数</Label>
              <Input type="number" value={editingItem.inspection_days || 0} onChange={(e) => updateEditingItem('inspection_days', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>到场次数</Label>
              <Input type="number" value={editingItem.on_site_count || 0} onChange={(e) => updateEditingItem('on_site_count', parseInt(e.target.value))} />
            </div>
            <div className="col-span-2 border-t pt-4 mt-2">
              <h4 className="font-medium text-sm mb-2">费用配置</h4>
            </div>
            <div className="space-y-2">
              <Label>巡检费(元)</Label>
              <Input type="number" value={editingItem.inspection_labor_fee || 0} onChange={(e) => updateEditingItem('inspection_labor_fee', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>上门费(元)</Label>
              <Input type="number" value={editingItem.visit_service_fee || 0} onChange={(e) => updateEditingItem('visit_service_fee', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>交通费(元)</Label>
              <Input type="number" value={editingItem.traffic_fee || 0} onChange={(e) => updateEditingItem('traffic_fee', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>故障处理费(元)</Label>
              <Input type="number" value={editingItem.fault_handling_fee || 0} onChange={(e) => updateEditingItem('fault_handling_fee', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>工具仪表摊销(元)</Label>
              <Input type="number" value={editingItem.tool_amortization || 0} onChange={(e) => updateEditingItem('tool_amortization', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>耗材费(元)</Label>
              <Input type="number" value={editingItem.consumable_fee || 0} onChange={(e) => updateEditingItem('consumable_fee', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>备件风险准备金(元)</Label>
              <Input type="number" value={editingItem.spare_part_reserve || 0} onChange={(e) => updateEditingItem('spare_part_reserve', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>备件费(元)</Label>
              <Input type="number" value={editingItem.spare_part_fee || 0} onChange={(e) => updateEditingItem('spare_part_fee', parseFloat(e.target.value))} />
            </div>
          </div>
        );

      case 'self_construction_quotas':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>工序ID</Label>
              <Input value={safeValue(editingItem.id)} onChange={(e) => updateEditingItem('id', e.target.value)} disabled={!isAdding} />
            </div>
            <div className="space-y-2">
              <Label>类别</Label>
              <Input value={safeValue(editingItem.category)} onChange={(e) => updateEditingItem('category', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>工序名称</Label>
              <Input value={safeValue(editingItem.name)} onChange={(e) => updateEditingItem('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>单位</Label>
              <Input value={safeValue(editingItem.unit)} onChange={(e) => updateEditingItem('unit', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>数量</Label>
              <Input type="number" value={editingItem.quantity || 0} onChange={(e) => updateEditingItem('quantity', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>单价</Label>
              <Input type="number" value={editingItem.price || 0} onChange={(e) => updateEditingItem('price', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input type="number" value={editingItem.sort_order || 0} onChange={(e) => updateEditingItem('sort_order', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>备注</Label>
              <Input value={safeValue(editingItem.remark)} onChange={(e) => updateEditingItem('remark', e.target.value)} />
            </div>
          </div>
        );

      case 'intelligent_project_quotas':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>项目ID</Label>
              <Input value={safeValue(editingItem.id)} onChange={(e) => updateEditingItem('id', e.target.value)} disabled={!isAdding} />
            </div>
            <div className="space-y-2">
              <Label>序号</Label>
              <Input type="number" value={editingItem.serial_number || 0} onChange={(e) => updateEditingItem('serial_number', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>类别</Label>
              <Input value={safeValue(editingItem.category)} onChange={(e) => updateEditingItem('category', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>项目名称</Label>
              <Input value={safeValue(editingItem.name)} onChange={(e) => updateEditingItem('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>品牌型号</Label>
              <Input value={safeValue(editingItem.brand_model)} onChange={(e) => updateEditingItem('brand_model', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>单位</Label>
              <Input value={safeValue(editingItem.unit)} onChange={(e) => updateEditingItem('unit', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>单价</Label>
              <Input type="number" value={editingItem.price || 0} onChange={(e) => updateEditingItem('price', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>可抵扣税率(%)</Label>
              <Input type="number" value={editingItem.deductible_tax_rate || 0} onChange={(e) => updateEditingItem('deductible_tax_rate', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input type="number" value={editingItem.sort_order || 0} onChange={(e) => updateEditingItem('sort_order', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>描述</Label>
              <Input value={safeValue(editingItem.description)} onChange={(e) => updateEditingItem('description', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>备注</Label>
              <Input value={safeValue(editingItem.remark)} onChange={(e) => updateEditingItem('remark', e.target.value)} />
            </div>
          </div>
        );

      case 'labor_price_config':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>等级</Label>
              <Input value={safeValue(editingItem.level)} onChange={(e) => updateEditingItem('level', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>单价</Label>
              <Input type="number" value={editingItem.unit_price || 0} onChange={(e) => updateEditingItem('unit_price', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>单位</Label>
              <Input value={safeValue(editingItem.unit)} onChange={(e) => updateEditingItem('unit', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input type="number" value={editingItem.sort_order || 0} onChange={(e) => updateEditingItem('sort_order', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>是否启用</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editingItem.is_active ?? 1} 
                onChange={(e) => updateEditingItem('is_active', parseInt(e.target.value))}
              >
                <option value={1}>启用</option>
                <option value={0}>禁用</option>
              </select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>描述</Label>
              <Input value={safeValue(editingItem.description)} onChange={(e) => updateEditingItem('description', e.target.value)} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // 展开/折叠行
  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // 获取当前数据（支持分页）
  const getCurrentData = (): { data: any[]; total: number; totalPages: number } => {
    let allData: any[] = [];
    switch (activeTab) {
      case 'device_quotas': allData = filterData(deviceQuotas); break;
      case 'self_construction_quotas': allData = filterData(selfConstructionQuotas); break;
      case 'intelligent_project_quotas': allData = filterData(intelligentProjectQuotas); break;
      case 'labor_price_config': allData = filterData(laborPriceConfigs); break;
      default: return { data: [], total: 0, totalPages: 0 };
    }
    
    // 分页处理
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return {
      data: allData.slice(startIndex, endIndex),
      total: allData.length,
      totalPages: Math.ceil(allData.length / pageSize)
    };
  };

  // 渲染表格
  const renderTable = () => {
    const { data, total, totalPages } = getCurrentData();

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600">加载中...</span>
        </div>
      );
    }

    if (total === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          {searchTerm || selectedCategory !== 'all' ? '没有找到匹配的数据' : '暂无数据，点击"新增"按钮添加'}
        </div>
      );
    }

    // 计算当前页的起始序号
    const startSerial = (currentPage - 1) * pageSize;

    switch (activeTab) {
      case 'device_quotas':
        return (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">序号</TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>品牌</TableHead>
                  <TableHead>型号</TableHead>
                  <TableHead>维保档次</TableHead>
                  <TableHead className="text-right">年故障次数</TableHead>
                  <TableHead className="text-right">年费用(元)</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data as DeviceQuota[]).map((item, index) => {
                  const isExpanded = expandedRows.has(item.id);
                  const serialNumber = startSerial + index + 1;
                  // 使用 city_price 作为默认显示金额（城市维保单价）
                  const annualFee = item.city_price || item.year1_total_price || 0;
                  return (
                    <React.Fragment key={item.id}>
                      <TableRow className="cursor-pointer hover:bg-slate-50" onClick={() => toggleRow(item.id)}>
                        <TableCell className="text-center text-slate-500 font-mono text-sm">{serialNumber}</TableCell>
                        <TableCell>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.brand || '-'}</TableCell>
                        <TableCell>{item.model}</TableCell>
                        <TableCell>{item.maintenance_tier}</TableCell>
                        <TableCell className="text-right">{item.annual_fault_count}</TableCell>
                        <TableCell className="text-right font-mono text-blue-600 font-medium">
                          {annualFee > 0 ? `¥${annualFee.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-slate-50">
                            <div className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">工程师等级</span>
                                  <p className="text-sm font-medium">{item.level || '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">工程师级别</span>
                                  <p className="text-sm font-medium">{item.engineer_level || '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">规格</span>
                                  <p className="text-sm font-medium">{item.specification || '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">故障处理天数</span>
                                  <p className="text-sm font-medium">{item.fault_processing_days || 0}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">巡检天数</span>
                                  <p className="text-sm font-medium">{item.inspection_days || 0}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">到场次数</span>
                                  <p className="text-sm font-medium">{item.on_site_count || 0}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">A档故障次数</span>
                                  <p className="text-sm font-medium">{item.a_gear_fault_count || 0}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">B档故障次数</span>
                                  <p className="text-sm font-medium">{item.b_gear_fault_count || 0}</p>
                                </div>
                                {/* 金额明细 */}
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">巡检人工费</span>
                                  <p className="text-sm font-medium font-mono">{item.inspection_labor_fee ? `¥${item.inspection_labor_fee.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">到场服务费</span>
                                  <p className="text-sm font-medium font-mono">{item.on_site_fee_annual ? `¥${item.on_site_fee_annual.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">交通费</span>
                                  <p className="text-sm font-medium font-mono">{item.traffic_fee ? `¥${item.traffic_fee.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">备件费</span>
                                  <p className="text-sm font-medium font-mono">{item.spare_part_reserve ? `¥${item.spare_part_reserve.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">第1年总价</span>
                                  <p className="text-sm font-medium font-mono text-blue-600">{item.year1_total_price ? `¥${item.year1_total_price.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">第2年总价</span>
                                  <p className="text-sm font-medium font-mono text-blue-600">{item.year2_total_price ? `¥${item.year2_total_price.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">第3年总价</span>
                                  <p className="text-sm font-medium font-mono text-blue-600">{item.year3_total_price ? `¥${item.year3_total_price.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">城区价格</span>
                                  <p className="text-sm font-medium font-mono">{item.urban_price ? `¥${item.urban_price.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">镇区价格</span>
                                  <p className="text-sm font-medium font-mono">{item.town_price ? `¥${item.town_price.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">乡村价格</span>
                                  <p className="text-sm font-medium font-mono">{item.rural_price ? `¥${item.rural_price.toFixed(2)}` : '-'}</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-slate-500">
                  共 {total} 条，第 {currentPage}/{totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="h-8 px-2 text-sm border border-slate-200 rounded-md"
                  >
                    <option value={10}>10条/页</option>
                    <option value={20}>20条/页</option>
                    <option value={50}>50条/页</option>
                    <option value={100}>100条/页</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    首页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    下一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    末页
                  </Button>
                </div>
              </div>
            )}
          </>
        );

      case 'self_construction_quotas':
        return (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">序号</TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead>工序名称</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">单价(元)</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data as SelfConstructionQuota[]).map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-slate-500 font-mono text-sm">{startSerial + index + 1}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-blue-600">¥{item.price.toFixed(2)}</TableCell>
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
            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-slate-500">
                  共 {total} 条，第 {currentPage}/{totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="h-8 px-2 text-sm border border-slate-200 rounded-md"
                  >
                    <option value={10}>10条/页</option>
                    <option value={20}>20条/页</option>
                    <option value={50}>50条/页</option>
                    <option value={100}>100条/页</option>
                  </select>
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>首页</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>上一页</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>下一页</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>末页</Button>
                </div>
              </div>
            )}
          </>
        );

      case 'intelligent_project_quotas':
        return (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">序号</TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead>项目名称</TableHead>
                  <TableHead>品牌型号</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead className="text-right">单价(元)</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data as IntelligentProjectQuota[]).map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-slate-500 font-mono text-sm">{startSerial + index + 1}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.brand_model}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right font-mono text-blue-600">¥{item.price.toFixed(2)}</TableCell>
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
            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-slate-500">
                  共 {total} 条，第 {currentPage}/{totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="h-8 px-2 text-sm border border-slate-200 rounded-md"
                  >
                    <option value={10}>10条/页</option>
                    <option value={20}>20条/页</option>
                    <option value={50}>50条/页</option>
                    <option value={100}>100条/页</option>
                  </select>
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>首页</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>上一页</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>下一页</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>末页</Button>
                </div>
              </div>
            )}
          </>
        );

      case 'labor_price_config':
        return (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">序号</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead className="text-right">单价(元)</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data as LaborPriceConfig[]).map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-slate-500 font-mono text-sm">{startSerial + index + 1}</TableCell>
                    <TableCell className="font-medium">{item.level}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right font-mono text-blue-600">¥{item.unit_price.toFixed(2)}</TableCell>
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
            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-slate-500">
                  共 {total} 条，第 {currentPage}/{totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="h-8 px-2 text-sm border border-slate-200 rounded-md"
                  >
                    <option value={10}>10条/页</option>
                    <option value={20}>20条/页</option>
                    <option value={50}>50条/页</option>
                    <option value={100}>100条/页</option>
                  </select>
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>首页</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>上一页</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>下一页</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>末页</Button>
                </div>
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  // 从Excel导入数据
  const handleImportExcel = async () => {
    if (!importUrl.trim()) {
      toast.error('请输入文件URL');
      return;
    }
    
    setImporting(true);
    try {
      const response = await fetch('/api/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl })
      });
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        setImportDialogOpen(false);
        setImportUrl('');
        loadData();
      } else {
        toast.error(result.error || '导入失败');
      }
    } catch (error) {
      console.error('导入Excel失败:', error);
      toast.error('导入Excel失败');
    } finally {
      setImporting(false);
    }
  };

  // 导入数据
  const handleSeedData = async () => {
    setConfirmError('');
    setConfirmPassword('');
    setPendingAction(() => async () => {
      try {
        setMessage(null);
        setLoading(true);
        const response = await fetch('/api/seed-all-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) {
          showMessage('success', result.message);
          loadData();
        } else {
          showMessage('error', result.error || '导入失败');
        }
      } catch (error) {
        console.error('导入数据失败:', error);
        showMessage('error', '导入数据失败');
      } finally {
        setLoading(false);
      }
    });
    setConfirmDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">定额库配置</h1>
          <p className="text-slate-600 mt-1">管理系统中所有设备参数、定额系数和价格配置</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50">
            <Upload className="w-4 h-4 mr-2" />
            从Excel导入
          </Button>
          <Button onClick={handleSeedData} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
            <Download className="w-4 h-4 mr-2" />
            导入定额库数据
          </Button>
          <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            新增
          </Button>
        </div>
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
            {activeTab !== 'labor_price_config' && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 px-3 py-1 text-sm border border-slate-200 rounded-md bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全部分类</option>
                {getCategories().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
            <span className="text-sm text-slate-500">
              共 {getCurrentData().total} 条记录
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

      {/* 导入Excel对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-600" />
              从Excel导入设备定额
            </DialogTitle>
            <DialogDescription>
              请输入Excel文件的URL地址，系统将自动解析并导入数据。如果设备名称重复，将覆盖现有数据。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>文件URL</Label>
              <Input
                placeholder="请输入Excel文件的URL地址"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleImportExcel();
                }}
                autoFocus
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium">导入说明：</p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li>支持 .xlsx 格式的Excel文件</li>
                <li>Excel应包含列：分类、名称、品牌、型号、档次、工程师等级、年故障次数等</li>
                <li>名称重复的设备将被更新覆盖</li>
                <li>新设备将被添加到定额库</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>
              取消
            </Button>
            <Button onClick={handleImportExcel} className="bg-purple-600 hover:bg-purple-700" disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  开始导入
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
