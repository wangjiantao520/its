'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, Edit, Trash2, Save, X, Search, Download, Upload,
  Cpu, Wrench, Building2, Users, AlertCircle, CheckCircle2, Loader2,
  ChevronDown, ChevronRight, CheckSquare, Settings, FileText, Database
} from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/user-context';
import { getDeviceImports, updateDeviceImportStatus, DeviceImportItem, ImportStatus } from '@/lib/roles';

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

// 云数据中心维保设备定额
interface MaintenanceDeviceQuota {
  id: string | number;
  name: string;
  brand: string;
  model: string;
  specification: string;
  category: string;
  unit: string;
  quantity: number;
  original_price: number;
  maintenance_rate: number;
  annual_fee: number;
  network_type: string;
  remark: string;
  sort_order: number;
}

// 维保费率配置
interface MaintenanceRateConfig {
  id: number;
  device_type: string;
  rate: number;
  description: string;
  sort_order: number;
}

// SLA配置
interface SlaConfig {
  id: number;
  level_name: string;
  inspection_frequency: string;
  response_time: string;
  fix_time: string;
  on_site_time: string;
  description: string;
  sort_order: number;
}

export default function DatabaseManagementPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('device_quotas');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // 数据状态
  const [deviceQuotas, setDeviceQuotas] = useState<DeviceQuota[]>([]);
  const [selfConstructionQuotas, setSelfConstructionQuotas] = useState<SelfConstructionQuota[]>([]);
  const [intelligentProjectQuotas, setIntelligentProjectQuotas] = useState<IntelligentProjectQuota[]>([]);
  const [laborPriceConfigs, setLaborPriceConfigs] = useState<LaborPriceConfig[]>([]);
  const [maintenanceDeviceQuotas, setMaintenanceDeviceQuotas] = useState<MaintenanceDeviceQuota[]>([]);
  const [maintenanceRateConfigs, setMaintenanceRateConfigs] = useState<MaintenanceRateConfig[]>([]);
  const [slaConfigs, setSlaConfigs] = useState<SlaConfig[]>([]);
  
  // 编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 设备清单审核状态
  const [imports, setImports] = useState<DeviceImportItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DeviceImportItem | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null);

  // 加载设备清单审核数据
  useEffect(() => {
    setImports(getDeviceImports());
  }, []);

  // 切换标签页时重置分类筛选和分页
  useEffect(() => {
    setSelectedCategory('all');
    setExpandedRows(new Set());
    setCurrentPage(1);
  }, [activeTab]);

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
        setMaintenanceDeviceQuotas(result.data.maintenance_device_quotas || []);
        setMaintenanceRateConfigs(result.data.maintenance_rate_config || []);
        setSlaConfigs(result.data.sla_config || []);
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

  // 加载数据
  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSave = async () => {
    await doSave();
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

  const handleDelete = (id: string | number) => {
    void doDelete(id);
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

      case 'maintenance_device_quotas':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>设备名称</Label>
              <Input value={safeValue(editingItem.name)} onChange={(e) => updateEditingItem('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>分类</Label>
              <Input value={safeValue(editingItem.category)} onChange={(e) => updateEditingItem('category', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>品牌</Label>
              <Input value={safeValue(editingItem.brand)} onChange={(e) => updateEditingItem('brand', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>型号</Label>
              <Input value={safeValue(editingItem.model)} onChange={(e) => updateEditingItem('model', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>单位</Label>
              <Input value={safeValue(editingItem.unit, '台')} onChange={(e) => updateEditingItem('unit', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>数量</Label>
              <Input type="number" value={editingItem.quantity || 1} onChange={(e) => updateEditingItem('quantity', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>中标单价(元)</Label>
              <Input type="number" value={editingItem.original_price || 0} onChange={(e) => updateEditingItem('original_price', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>维保率</Label>
              <Input type="number" step="0.01" value={editingItem.maintenance_rate || 0} onChange={(e) => updateEditingItem('maintenance_rate', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>年维保费(元)</Label>
              <Input type="number" value={editingItem.annual_fee || 0} onChange={(e) => updateEditingItem('annual_fee', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>网络类型</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={safeValue(editingItem.network_type, '内网')} 
                onChange={(e) => updateEditingItem('network_type', e.target.value)}
              >
                <option value="内网">内网</option>
                <option value="外网">外网</option>
              </select>
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
              <Label>备注</Label>
              <Input value={safeValue(editingItem.remark)} onChange={(e) => updateEditingItem('remark', e.target.value)} />
            </div>
          </div>
        );

      case 'maintenance_rate_config':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>设备类型</Label>
              <Input value={safeValue(editingItem.device_type)} onChange={(e) => updateEditingItem('device_type', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>维保率</Label>
              <Input type="number" step="0.01" value={editingItem.maintenance_rate || 0} onChange={(e) => updateEditingItem('maintenance_rate', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>描述</Label>
              <Input value={safeValue(editingItem.description)} onChange={(e) => updateEditingItem('description', e.target.value)} />
            </div>
          </div>
        );

      case 'sla_config':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>服务等级</Label>
              <Input value={safeValue(editingItem.sla_level)} onChange={(e) => updateEditingItem('sla_level', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>响应时间(小时)</Label>
              <Input type="number" value={editingItem.response_time || 0} onChange={(e) => updateEditingItem('response_time', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>解决时间(小时)</Label>
              <Input type="number" value={editingItem.resolution_time || 0} onChange={(e) => updateEditingItem('resolution_time', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>惩罚比例</Label>
              <Input type="number" step="0.01" value={editingItem.penalty_rate || 0} onChange={(e) => updateEditingItem('penalty_rate', parseFloat(e.target.value))} />
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
      case 'maintenance_device_quotas': allData = filterData(maintenanceDeviceQuotas); break;
      case 'maintenance_rate_config': allData = filterData(maintenanceRateConfigs); break;
      case 'sla_config': allData = filterData(slaConfigs); break;
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
                    <React.Fragment key={item.id || `device-${index}`}>
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
                  <TableRow key={item.id || `self-${index}`}>
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
                  <TableRow key={item.id || `intelligent-${index}`}>
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
                  <TableRow key={item.id || `labor-${index}`}>
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

      case 'maintenance_device_quotas':
        return (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">序号</TableHead>
                  <TableHead>设备名称</TableHead>
                  <TableHead>品牌</TableHead>
                  <TableHead>型号</TableHead>
                  <TableHead>网络类型</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">原价(元)</TableHead>
                  <TableHead className="text-right">维保费率</TableHead>
                  <TableHead className="text-right">年维保(元)</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data as MaintenanceDeviceQuota[]).map((item, index) => {
                  const serialNumber = startSerial + index + 1;
                  return (
                    <TableRow key={item.id || `m-device-${index}`} className="hover:bg-slate-50">
                      <TableCell className="text-center text-slate-500 font-mono text-sm">{serialNumber}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.brand || '-'}</TableCell>
                      <TableCell>{item.model || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={item.network_type === '内网' ? 'default' : 'secondary'}>
                          {item.network_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{item.original_price?.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{(item.maintenance_rate * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-right font-mono text-blue-600 font-medium">{item.annual_fee?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {/* 分页控件 */}
            <div className="flex items-center justify-between p-4 border-t border-slate-200">
              <div className="text-sm text-slate-500">
                共 {total} 条，第 {currentPage}/{totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="text-sm border border-slate-200 rounded px-2 py-1"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
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
          </>
        );

      case 'maintenance_rate_config':
        return (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">序号</TableHead>
                  <TableHead>设备类型</TableHead>
                  <TableHead className="text-right">维保率(%)</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data as MaintenanceRateConfig[]).map((item, index) => {
                  const serialNumber = startSerial + index + 1;
                  return (
                    <TableRow key={item.id || `rate-${index}`} className="hover:bg-slate-50">
                      <TableCell className="text-center text-slate-500 font-mono text-sm">{serialNumber}</TableCell>
                      <TableCell className="font-medium">{item.device_type}</TableCell>
                      <TableCell className="text-right font-mono text-blue-600">{item.rate}%</TableCell>
                      <TableCell className="text-slate-600">{item.description}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        );

      case 'sla_config':
        return (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">序号</TableHead>
                  <TableHead>服务等级</TableHead>
                  <TableHead>巡检频率</TableHead>
                  <TableHead>响应时间</TableHead>
                  <TableHead>修复时间</TableHead>
                  <TableHead>到场时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data as SlaConfig[]).map((item, index) => {
                  const serialNumber = startSerial + index + 1;
                  return (
                    <TableRow key={item.id || `sla-${index}`} className="hover:bg-slate-50">
                      <TableCell className="text-center text-slate-500 font-mono text-sm">{serialNumber}</TableCell>
                      <TableCell className="font-medium">
                        <Badge variant={item.level_name.includes('金牌') ? 'default' : item.level_name.includes('银牌') ? 'secondary' : 'outline'}>
                          {item.level_name}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.inspection_frequency}</TableCell>
                      <TableCell>{item.response_time}</TableCell>
                      <TableCell>{item.fix_time}</TableCell>
                      <TableCell>{item.on_site_time}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        );

      default:
        return null;
    }
  };

  // 从Excel导入数据（支持URL和文件上传）
  const handleImportExcel = async () => {
    if (!importUrl.trim() && !selectedFile) {
      toast.error('请输入文件URL或选择文件');
      return;
    }
    
    setImporting(true);
    try {
      let response: Response;
      
      if (selectedFile) {
        // 文件上传模式
        const formData = new FormData();
        formData.append('file', selectedFile);
        response = await fetch('/api/import-file', {
          method: 'POST',
          body: formData
        });
      } else {
        // URL模式
        response = await fetch('/api/import-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: importUrl })
        });
      }
      
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        setImportDialogOpen(false);
        setImportUrl('');
        setSelectedFile(null);
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

  // 下载导入模板
  const handleDownloadTemplate = () => {
    window.open('/api/import-template', '_blank');
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('请选择Excel文件（.xlsx或.xls格式）');
        return;
      }
      setSelectedFile(file);
      setImportUrl(''); // 清空URL
    }
  };

  // 处理拖拽
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('请选择Excel文件（.xlsx或.xls格式）');
        return;
      }
      setSelectedFile(file);
      setImportUrl(''); // 清空URL
    }
  };

  // 导入数据
  const handleSeedData = async () => {
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
        await loadData();
      } else {
        showMessage('error', result.error || '导入失败');
      }
    } catch (error) {
      console.error('导入数据失败:', error);
      showMessage('error', '导入数据失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">基础数据管理</h1>
            <p className="text-sm text-slate-500 mt-0.5">管理设备定额、人工单价、设备清单审核和系统配置</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-700">
            <Upload className="w-4 h-4 mr-2" />
            Excel导入
          </Button>
          <Button onClick={handleSeedData} variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-700">
            <Download className="w-4 h-4 mr-2" />
            初始化数据
          </Button>
          <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
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
        <TabsList className="h-auto w-full flex flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger 
            value="device_quotas" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent px-4 py-2.5 transition-all"
          >
            <Cpu className="w-4 h-4 mr-2" />
            设备定额
          </TabsTrigger>
          <TabsTrigger 
            value="self_construction_quotas" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent px-4 py-2.5 transition-all"
          >
            <Wrench className="w-4 h-4 mr-2" />
            自施工工序
          </TabsTrigger>
          <TabsTrigger 
            value="intelligent_project_quotas" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent px-4 py-2.5 transition-all"
          >
            <Building2 className="w-4 h-4 mr-2" />
            智能化项目
          </TabsTrigger>
          <TabsTrigger 
            value="labor_price_config" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent px-4 py-2.5 transition-all"
          >
            <Users className="w-4 h-4 mr-2" />
            人工单价
          </TabsTrigger>
          <TabsTrigger 
            value="device_review" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent px-4 py-2.5 transition-all"
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            设备清单审核
          </TabsTrigger>
          <TabsTrigger 
            value="system_settings" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent px-4 py-2.5 transition-all"
          >
            <Settings className="w-4 h-4 mr-2" />
            系统参数
          </TabsTrigger>
          <TabsTrigger 
            value="maintenance_device_quotas" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent px-4 py-2.5 transition-all"
          >
            <Database className="w-4 h-4 mr-2" />
            云数据中心定额库
          </TabsTrigger>
          <TabsTrigger 
            value="maintenance_rate_config" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent px-4 py-2.5 transition-all"
          >
            <FileText className="w-4 h-4 mr-2" />
            维保费率配置
          </TabsTrigger>
          <TabsTrigger 
            value="sla_config" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent px-4 py-2.5 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            SLA配置
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {activeTab !== 'device_review' && activeTab !== 'system_settings' && (
          <div className="flex items-center gap-3 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索名称、品牌、型号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-slate-200"
              />
            </div>
            {activeTab !== 'labor_price_config' && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 px-3 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全部分类</option>
                {getCategories().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                共 <span className="font-semibold text-slate-700">{getCurrentData().total}</span> 条记录
              </span>
            </div>
          </div>
          )}

          <Card className="border-slate-200 shadow-sm overflow-hidden">
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

      {/* 设备清单审核标签页 */}
      {activeTab === 'device_review' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                    待审核清单
                  </CardTitle>
                  <CardDescription>审核ITS成员提交的设备清单</CardDescription>
                </div>
                {imports.filter(i => i.status === 'pending').length > 0 && (
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    待审核: {imports.filter(i => i.status === 'pending').length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {imports.filter(i => i.status === 'pending').length === 0 ? (
                <p className="text-muted-foreground text-center py-8">暂无待审核的清单</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>提交人</TableHead>
                      <TableHead>项目名称</TableHead>
                      <TableHead>设备数量</TableHead>
                      <TableHead>提交时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.filter(i => i.status === 'pending').map((item, index) => (
                      <TableRow key={item.id || `import-pending-${index}`}>
                        <TableCell className="font-medium">{item.submittedBy}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.deviceCount} 台</TableCell>
                        <TableCell>{new Date(item.submittedAt).toLocaleString('zh-CN')}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">待审核</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => {
                              setSelectedItem(item);
                              setDialogAction('approve');
                              setReviewComment('');
                              setIsReviewDialogOpen(true);
                            }}>
                              <CheckCircle2 className="w-4 h-4 mr-1 text-green-600" />
                              通过
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setSelectedItem(item);
                              setDialogAction('reject');
                              setReviewComment('');
                              setIsReviewDialogOpen(true);
                            }}>
                              <X className="w-4 h-4 mr-1 text-red-600" />
                              拒绝
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>已审核清单</CardTitle>
            </CardHeader>
            <CardContent>
              {imports.filter(i => i.status !== 'pending').length === 0 ? (
                <p className="text-muted-foreground text-center py-8">暂无已审核的清单</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>提交人</TableHead>
                      <TableHead>项目名称</TableHead>
                      <TableHead>设备数量</TableHead>
                      <TableHead>提交时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>审核人</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.filter(i => i.status !== 'pending').map((item, index) => (
                      <TableRow key={item.id || `import-history-${index}`}>
                        <TableCell className="font-medium">{item.submittedBy}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.deviceCount} 台</TableCell>
                        <TableCell>{new Date(item.submittedAt).toLocaleString('zh-CN')}</TableCell>
                        <TableCell>
                          {item.status === 'approved' ? (
                            <Badge className="bg-green-600">已通过</Badge>
                          ) : (
                            <Badge className="bg-red-600">已拒绝</Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.reviewedBy || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 系统参数标签页 */}
      {activeTab === 'system_settings' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-600" />
                系统参数设置
              </CardTitle>
              <CardDescription>配置系统全局参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">报价参数</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>管理费率 (%)</Label>
                    <Input type="number" defaultValue="10" />
                  </div>
                  <div className="space-y-2">
                    <Label>利润率 (%)</Label>
                    <Input type="number" defaultValue="8" />
                  </div>
                  <div className="space-y-2">
                    <Label>税率 (%)</Label>
                    <Input type="number" defaultValue="6" />
                  </div>
                  <div className="space-y-2">
                    <Label>风险系数 (%)</Label>
                    <Input type="number" defaultValue="5" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">维保参数</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>响应时间 (小时)</Label>
                    <Input type="number" defaultValue="4" />
                  </div>
                  <div className="space-y-2">
                    <Label>到场时间 (小时)</Label>
                    <Input type="number" defaultValue="24" />
                  </div>
                  <div className="space-y-2">
                    <Label>巡检周期 (月)</Label>
                    <Input type="number" defaultValue="3" />
                  </div>
                  <div className="space-y-2">
                    <Label>质保期 (年)</Label>
                    <Input type="number" defaultValue="1" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => toast.success('系统参数已保存')}>
                  <Save className="w-4 h-4 mr-2" />
                  保存设置
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 审核确认对话框 */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'approve' ? '确认通过' : '确认拒绝'}
            </DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>
                  {dialogAction === 'approve' 
                    ? `确认通过 ${selectedItem.submittedBy} 提交的 "${selectedItem.category}" 设备清单？`
                    : `确认拒绝 ${selectedItem.submittedBy} 提交的 "${selectedItem.category}" 设备清单？`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>审核意见（可选）</Label>
            <Textarea
              placeholder="请输入审核意见..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={() => {
                if (!selectedItem || !dialogAction) return;
                const status = dialogAction === 'approve' ? 'approved' : 'rejected';
                updateDeviceImportStatus(selectedItem.id, status, user?.name || '', reviewComment);
                setImports(getDeviceImports());
                setIsReviewDialogOpen(false);
                setSelectedItem(null);
                setDialogAction(null);
                setReviewComment('');
                toast.success(dialogAction === 'approve' ? '清单已通过' : '清单已拒绝');
              }}
              className={dialogAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
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
              拖拽Excel文件到下方区域，或点击选择文件。也可以输入文件URL地址。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* 拖拽上传区域 */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              {selectedFile ? (
                <div>
                  <p className="text-lg font-medium text-primary">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB · 点击重新选择
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium">拖拽文件到此处</p>
                  <p className="text-sm text-muted-foreground mt-1">或点击选择文件</p>
                </div>
              )}
            </div>

            {/* 分隔线 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">或者</span>
              </div>
            </div>

            {/* URL输入 */}
            <div className="space-y-2">
              <Label>文件URL</Label>
              <Input
                placeholder="请输入Excel文件的URL地址"
                value={importUrl}
                onChange={(e) => {
                  setImportUrl(e.target.value);
                  setSelectedFile(null); // 清空文件选择
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleImportExcel();
                }}
              />
            </div>

            {/* 下载模板 */}
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleDownloadTemplate} className="text-sm">
                <Download className="w-4 h-4 mr-2" />
                下载导入模板
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium">导入说明：</p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li>支持 .xlsx 和 .xls 格式的Excel文件</li>
                <li>请按照模板格式填写数据</li>
                <li>名称重复的设备将被更新覆盖</li>
                <li>新设备将被添加到定额库</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportDialogOpen(false);
              setSelectedFile(null);
              setImportUrl('');
              setIsDragging(false);
            }} disabled={importing}>
              取消
            </Button>
            <Button 
              onClick={handleImportExcel} 
              className="bg-purple-600 hover:bg-purple-700" 
              disabled={importing || (!selectedFile && !importUrl)}
            >
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
