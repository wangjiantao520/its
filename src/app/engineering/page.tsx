'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, FileDown, Eye, FileSpreadsheet, Loader2, Search, Pencil, MoreHorizontal, RefreshCw, ClipboardList, ArrowRightLeft, X, BarChart3, TrendingUp, TrendingDown, Users, DollarSign, FileText, Activity, Upload, Download, Share2, Link2, Copy, Check, Clock, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import {
  generateEngineeringQuoteHTML,
  downloadAsWord,
  downloadAsPDF,
  convertToChineseCurrency,
  type EngineeringQuoteExportData,
} from '@/lib/export-utils';
import {
  SELF_CONSTRUCTION_QUOTA,
  INTELLIGENT_PROJECT_QUOTA,
  type SelfConstructionItem,
  type IntelligentItem,
} from '@/lib/self-construction-quota';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from '@/components/ui/pagination';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

interface QuoteItem {
  id: number;
  itemType: 'selfConstruction' | 'intelligent';
  itemId: string;
  quantity: number;
}

interface EngineeringQuote {
  id: number;
  quote_number: string;
  project_name: string;
  client_name: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  construction_area: number | null;
  management_rate: number;
  profit_rate: number;
  regulatory_rate: number;
  tax_rate: number;
  subtotal: number;
  management_fee: number;
  profit: number;
  regulatory_fee: number;
  tax: number;
  total: number;
  status: string;
  items: Array<{
    itemType: string;
    itemId: string;
    quantity: number;
    name: string;
    unit: string;
    price: number;
  }> | null;
  created_at: string;
  updated_at: string;
}

// 统计数据接口
interface StatsOverview {
  totalCount: number;
  totalAmount: number;
  avgAmount: number;
  maxAmount: number;
  minAmount: number;
}

interface StatsByStatus {
  status: string;
  count: number;
  totalAmount: number;
}

interface StatsByMonth {
  month: string;
  count: number;
  totalAmount: number;
}

interface StatsByClient {
  clientName: string;
  count: number;
  totalAmount: number;
}

interface StatsByAmountRange {
  range: string;
  count: number;
}

interface StatsData {
  overview: StatsOverview;
  byStatus: StatsByStatus[];
  byMonth: StatsByMonth[];
  byClient: StatsByClient[];
  byAmountRange: StatsByAmountRange[];
  thisMonth: {
    count: number;
    totalAmount: number;
    countChange: number;
    amountChange: number;
  };
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

  // 草稿相关状态
  const [savedQuoteId, setSavedQuoteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // 列表相关状态
  const [quotes, setQuotes] = useState<EngineeringQuote[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const pageSize = 10;

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EngineeringQuote | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // 预览对话框
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // 状态变更对话框
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<EngineeringQuote | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // PDF导出状态
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // 批量选中状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBatchExporting, setIsBatchExporting] = useState(false);

  // 报价对比状态
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareQuoteA, setCompareQuoteA] = useState<EngineeringQuote | null>(null);
  const [compareQuoteB, setCompareQuoteB] = useState<EngineeringQuote | null>(null);
  const [compareDataA, setCompareDataA] = useState<EngineeringQuote | null>(null);
  const [compareDataB, setCompareDataB] = useState<EngineeringQuote | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  // 统计看板状态
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // 定额库搜索/筛选状态
  const [quotaSearchKeyword, setQuotaSearchKeyword] = useState('');
  const [quotaCategoryFilter, setQuotaCategoryFilter] = useState<string>('all');

  // 定额库数据状态（从数据库加载）
  const [dbSelfConstruction, setDbSelfConstruction] = useState<SelfConstructionItem[]>([]);
  const [dbIntelligentProject, setDbIntelligentProject] = useState<IntelligentItem[]>([]);
  const [isLoadingQuotas, setIsLoadingQuotas] = useState(false);

  // 定额库分页状态
  const [selfConstructionPage, setSelfConstructionPage] = useState(1);
  const [selfConstructionTotalPages, setSelfConstructionTotalPages] = useState(1);
  const [selfConstructionTotal, setSelfConstructionTotal] = useState(0);
  const [intelligentPage, setIntelligentPage] = useState(1);
  const [intelligentTotalPages, setIntelligentTotalPages] = useState(1);
  const [intelligentTotal, setIntelligentTotal] = useState(0);
  const quotaPageSize = 10;

  // 定额库编辑对话框状态
  const [quotaEditDialogOpen, setQuotaEditDialogOpen] = useState(false);
  const [quotaEditType, setQuotaEditType] = useState<'selfConstruction' | 'intelligent'>('selfConstruction');
  const [quotaEditMode, setQuotaEditMode] = useState<'add' | 'edit'>('add');
  const [quotaEditForm, setQuotaEditForm] = useState<Record<string, any>>({});

  // 定额库删除确认对话框
  const [quotaDeleteDialogOpen, setQuotaDeleteDialogOpen] = useState(false);
  const [quotaDeleteTarget, setQuotaDeleteTarget] = useState<{ type: 'selfConstruction' | 'intelligent'; id: string; name: string } | null>(null);

  // 定额库导入状态
  const [quotaImportDialogOpen, setQuotaImportDialogOpen] = useState(false);
  const [quotaImportType, setQuotaImportType] = useState<'selfConstruction' | 'intelligent'>('selfConstruction');
  const [quotaImportData, setQuotaImportData] = useState<Record<string, any>[]>([]);
  const [quotaImportErrors, setQuotaImportErrors] = useState<string[]>([]);
  const [quotaImportFileName, setQuotaImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const quotaFileInputRef = useRef<HTMLInputElement>(null);

  // 分享链接状态
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<EngineeringQuote | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiresDays, setShareExpiresDays] = useState(7);
  const [shareMaxViews, setShareMaxViews] = useState(0);
  const [shareRemark, setShareRemark] = useState('');
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareResult, setShareResult] = useState<{ shareUrl: string; shareToken: string } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // 分享记录管理状态
  const [shareListDialogOpen, setShareListDialogOpen] = useState(false);
  const [shareList, setShareList] = useState<any[]>([]);
  const [isLoadingShareList, setIsLoadingShareList] = useState(false);

  // 加载统计数据
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/engineering-quotes/stats');
      const result = await response.json();

      if (result.success) {
        setStatsData(result.data);
      } else {
        toast.error('加载统计失败', { description: result.error || '无法获取统计数据' });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
      toast.error('加载失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // 加载定额库数据（支持服务端分页、搜索和筛选）
  const fetchQuotas = useCallback(async (options?: {
    selfPage?: number;
    intelligentPage?: number;
    keyword?: string;
    category?: string;
  }) => {
    setIsLoadingQuotas(true);
    const sPage = options?.selfPage ?? selfConstructionPage;
    const iPage = options?.intelligentPage ?? intelligentPage;
    const keyword = options?.keyword ?? quotaSearchKeyword;
    const category = options?.category ?? quotaCategoryFilter;

    try {
      const selfParams = new URLSearchParams({
        page: String(sPage),
        limit: String(quotaPageSize),
      });
      if (keyword) selfParams.set('keyword', keyword);
      if (category && category !== 'all') selfParams.set('category', category);

      const intelligentParams = new URLSearchParams({
        page: String(iPage),
        limit: String(quotaPageSize),
      });
      if (keyword) intelligentParams.set('keyword', keyword);
      if (category && category !== 'all') intelligentParams.set('category', category);

      const [selfRes, intelligentRes] = await Promise.all([
        fetch(`/api/self-construction-quotas?${selfParams.toString()}`),
        fetch(`/api/intelligent-project-quotas?${intelligentParams.toString()}`),
      ]);
      const selfResult = await selfRes.json();
      const intelligentResult = await intelligentRes.json();

      if (selfResult.success) {
        setDbSelfConstruction(selfResult.data.map((row: any) => ({
          id: row.id,
          category: row.category,
          name: row.name,
          unit: row.unit,
          quantity: Number(row.quantity),
          price: Number(row.price),
          remark: row.remark || '',
        })));
        if (selfResult.pagination) {
          setSelfConstructionTotalPages(selfResult.pagination.totalPages);
          setSelfConstructionTotal(selfResult.pagination.total);
          setSelfConstructionPage(selfResult.pagination.page);
        }
      }
      if (intelligentResult.success) {
        setDbIntelligentProject(intelligentResult.data.map((row: any) => ({
          id: row.id,
          serialNumber: Number(row.serial_number),
          category: row.category,
          name: row.name,
          brandModel: row.brand_model || '',
          description: row.description || '',
          deductibleTaxRate: Number(row.deductible_tax_rate),
          unit: row.unit,
          price: Number(row.price),
          remark: row.remark || '',
        })));
        if (intelligentResult.pagination) {
          setIntelligentTotalPages(intelligentResult.pagination.totalPages);
          setIntelligentTotal(intelligentResult.pagination.total);
          setIntelligentPage(intelligentResult.pagination.page);
        }
      }

      // 如果数据库为空（无筛选条件时），自动初始化种子数据
      if (!keyword && (!category || category === 'all') && selfResult.success && intelligentResult.success && selfResult.pagination?.total === 0 && intelligentResult.pagination?.total === 0) {
        const seedRes = await fetch('/api/quotas-seed', { method: 'POST' });
        const seedResult = await seedRes.json();
        if (seedResult.success && (seedResult.data.selfInserted > 0 || seedResult.data.intelligentInserted > 0)) {
          // 重新加载
          const [selfRes2, intelligentRes2] = await Promise.all([
            fetch(`/api/self-construction-quotas?page=1&limit=${quotaPageSize}`),
            fetch(`/api/intelligent-project-quotas?page=1&limit=${quotaPageSize}`),
          ]);
          const selfResult2 = await selfRes2.json();
          const intelligentResult2 = await intelligentRes2.json();
          if (selfResult2.success) {
            setDbSelfConstruction(selfResult2.data.map((row: any) => ({
              id: row.id, category: row.category, name: row.name, unit: row.unit,
              quantity: Number(row.quantity), price: Number(row.price), remark: row.remark || '',
            })));
            if (selfResult2.pagination) {
              setSelfConstructionTotalPages(selfResult2.pagination.totalPages);
              setSelfConstructionTotal(selfResult2.pagination.total);
              setSelfConstructionPage(1);
            }
          }
          if (intelligentResult2.success) {
            setDbIntelligentProject(intelligentResult2.data.map((row: any) => ({
              id: row.id, serialNumber: Number(row.serial_number), category: row.category, name: row.name,
              brandModel: row.brand_model || '', description: row.description || '',
              deductibleTaxRate: Number(row.deductible_tax_rate), unit: row.unit,
              price: Number(row.price), remark: row.remark || '',
            })));
            if (intelligentResult2.pagination) {
              setIntelligentTotalPages(intelligentResult2.pagination.totalPages);
              setIntelligentTotal(intelligentResult2.pagination.total);
              setIntelligentPage(1);
            }
          }
          toast.success('定额数据已初始化');
        }
      }
    } catch (error) {
      console.error('加载定额库数据失败:', error);
      toast.error('加载定额库失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsLoadingQuotas(false);
    }
  }, [selfConstructionPage, intelligentPage, quotaSearchKeyword, quotaCategoryFilter, quotaPageSize]);

  // 保存定额项（新增或编辑）
  const handleSaveQuota = useCallback(async () => {
    const isSelf = quotaEditType === 'selfConstruction';
    const apiUrl = isSelf ? '/api/self-construction-quotas' : '/api/intelligent-project-quotas';
    const method = quotaEditMode === 'add' ? 'POST' : 'PUT';

    const form = quotaEditForm;
    if (!form.id || !form.category || !form.name || !form.unit || form.price === undefined || form.price === '') {
      toast.error('请填写必填字段', { description: '编号、分类、名称、单位、单价为必填' });
      return;
    }

    try {
      let body: Record<string, any>;
      if (isSelf) {
        body = {
          id: form.id,
          category: form.category,
          name: form.name,
          unit: form.unit,
          quantity: form.quantity || 1,
          price: Number(form.price),
          remark: form.remark || '',
        };
      } else {
        body = {
          id: form.id,
          serialNumber: form.serialNumber || 0,
          category: form.category,
          name: form.name,
          brandModel: form.brandModel || '',
          description: form.description || '',
          deductibleTaxRate: form.deductibleTaxRate || 0,
          unit: form.unit,
          price: Number(form.price),
          remark: form.remark || '',
        };
      }

      const response = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (result.success) {
        toast.success(quotaEditMode === 'add' ? '新增成功' : '保存成功');
        setQuotaEditDialogOpen(false);
        fetchQuotas();
      } else {
        toast.error('操作失败', { description: result.error || '请稍后重试' });
      }
    } catch (error) {
      console.error('保存定额项失败:', error);
      toast.error('保存失败', { description: '网络错误，请稍后重试' });
    }
  }, [quotaEditType, quotaEditMode, quotaEditForm, fetchQuotas]);

  // 删除定额项
  const handleDeleteQuota = useCallback(async () => {
    if (!quotaDeleteTarget) return;
    const apiUrl = quotaDeleteTarget.type === 'selfConstruction'
      ? '/api/self-construction-quotas'
      : '/api/intelligent-project-quotas';

    try {
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: quotaDeleteTarget.id }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success('删除成功');
        setQuotaDeleteDialogOpen(false);
        setQuotaDeleteTarget(null);
        fetchQuotas();
      } else {
        toast.error('删除失败', { description: result.error || '请稍后重试' });
      }
    } catch (error) {
      console.error('删除定额项失败:', error);
      toast.error('删除失败', { description: '网络错误，请稍后重试' });
    }
  }, [quotaDeleteTarget, fetchQuotas]);

  // 打开新增定额对话框
  const openAddQuotaDialog = (type: 'selfConstruction' | 'intelligent') => {
    setQuotaEditType(type);
    setQuotaEditMode('add');
    if (type === 'selfConstruction') {
      setQuotaEditForm({ id: '', category: '', name: '', unit: '', quantity: 1, price: '', remark: '' });
    } else {
      setQuotaEditForm({ id: '', serialNumber: 0, category: '', name: '', brandModel: '', description: '', deductibleTaxRate: 13, unit: '', price: '', remark: '' });
    }
    setQuotaEditDialogOpen(true);
  };

  // 打开编辑定额对话框
  const openEditQuotaDialog = (type: 'selfConstruction' | 'intelligent', item: any) => {
    setQuotaEditType(type);
    setQuotaEditMode('edit');
    if (type === 'selfConstruction') {
      setQuotaEditForm({
        id: item.id, category: item.category, name: item.name, unit: item.unit,
        quantity: item.quantity, price: item.price, remark: item.remark,
      });
    } else {
      setQuotaEditForm({
        id: item.id, serialNumber: item.serialNumber, category: item.category, name: item.name,
        brandModel: item.brandModel, description: item.description,
        deductibleTaxRate: item.deductibleTaxRate, unit: item.unit, price: item.price, remark: item.remark,
      });
    }
    setQuotaEditDialogOpen(true);
  };

  // 打开删除确认对话框
  const openDeleteQuotaDialog = (type: 'selfConstruction' | 'intelligent', id: string, name: string) => {
    setQuotaDeleteTarget({ type, id, name });
    setQuotaDeleteDialogOpen(true);
  };

  // 打开导入对话框
  const openImportDialog = (type: 'selfConstruction' | 'intelligent') => {
    setQuotaImportType(type);
    setQuotaImportData([]);
    setQuotaImportErrors([]);
    setQuotaImportFileName('');
    setQuotaImportDialogOpen(true);
  };

  // 解析Excel文件
  const handleQuotaFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('文件格式错误', { description: '请选择 .xlsx、.xls 或 .csv 格式的文件' });
      return;
    }

    setQuotaImportFileName(file.name);
    setQuotaImportErrors([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        if (!arrayBuffer) return;

        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          setQuotaImportErrors(['文件内容为空或仅有表头行']);
          setQuotaImportData([]);
          return;
        }

        // 第一行为表头
        const headers = jsonData[0].map((h: any) => String(h || '').trim());
        const rows: Record<string, any>[] = [];
        const errors: string[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0 || !row[0]) continue;

          const record: Record<string, any> = {};
          headers.forEach((header, colIdx) => {
            record[header] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
          });

          // 基本验证
          const rowNum = i + 1;
          if (!record['编号'] && !record['id'] && !record['ID']) {
            errors.push(`第${rowNum}行：缺少编号`);
          }
          if (!record['分类'] && !record['category']) {
            errors.push(`第${rowNum}行：缺少分类`);
          }
          if (!record['名称'] && !record['定额名称'] && !record['name']) {
            errors.push(`第${rowNum}行：缺少名称`);
          }

          rows.push(record);
        }

        if (rows.length === 0) {
          errors.push('未解析到有效数据行');
        }

        setQuotaImportData(rows);
        setQuotaImportErrors(errors);
      } catch (error) {
        console.error('解析Excel失败:', error);
        setQuotaImportErrors(['文件解析失败，请检查文件格式是否正确']);
        setQuotaImportData([]);
      }
    };
    reader.readAsArrayBuffer(file);

    // 重置input以支持重复选择同一文件
    e.target.value = '';
  }, []);

  // 执行批量导入
  const handleQuotaImport = useCallback(async () => {
    if (quotaImportData.length === 0) return;
    setIsImporting(true);

    const isSelf = quotaImportType === 'selfConstruction';
    const apiUrl = isSelf ? '/api/self-construction-quotas' : '/api/intelligent-project-quotas';

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < quotaImportData.length; i++) {
      const record = quotaImportData[i];
      const rowNum = i + 2;

      try {
        // 兼容中英文表头
        const id = record['编号'] || record['id'] || record['ID'] || '';
        const category = record['分类'] || record['category'] || '';
        const name = record['名称'] || record['定额名称'] || record['name'] || '';
        const unit = record['单位'] || record['unit'] || '';
        const priceStr = record['单价'] || record['price'] || '0';
        const remark = record['备注'] || record['remark'] || '';

        if (!id || !category || !name || !unit) {
          errors.push(`第${rowNum}行：必填字段不完整，已跳过`);
          skipCount++;
          continue;
        }

        const price = parseFloat(priceStr);
        if (isNaN(price) || price < 0) {
          errors.push(`第${rowNum}行：单价格式错误，已跳过`);
          skipCount++;
          continue;
        }

        let body: Record<string, any>;

        if (isSelf) {
          const quantity = parseFloat(record['数量'] || record['quantity'] || '1');
          body = { id, category, name, unit, quantity: isNaN(quantity) ? 1 : quantity, price, remark };
        } else {
          const serialNumber = parseInt(record['序号'] || record['serialNumber'] || '0');
          const brandModel = record['品牌型号'] || record['brandModel'] || record['品牌'] || '';
          const description = record['描述'] || record['description'] || record['说明'] || '';
          const taxRateStr = record['可抵扣税率'] || record['税率'] || record['deductibleTaxRate'] || '0';
          const deductibleTaxRate = parseFloat(taxRateStr);
          body = {
            id, serialNumber: isNaN(serialNumber) ? 0 : serialNumber, category, name,
            brandModel, description, deductibleTaxRate: isNaN(deductibleTaxRate) ? 0 : deductibleTaxRate,
            unit, price, remark,
          };
        }

        // 尝试新增，若ID已存在则更新
        const postRes = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const postResult = await postRes.json();

        if (postResult.success) {
          successCount++;
        } else if (postResult.error?.includes('已存在')) {
          // ID已存在，尝试更新
          const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const putResult = await putRes.json();
          if (putResult.success) {
            successCount++;
          } else {
            errors.push(`第${rowNum}行：更新失败 - ${putResult.error}`);
            errorCount++;
          }
        } else {
          errors.push(`第${rowNum}行：${postResult.error}`);
          errorCount++;
        }
      } catch (err) {
        errors.push(`第${rowNum}行：处理异常`);
        errorCount++;
      }
    }

    setIsImporting(false);

    if (successCount > 0) {
      toast.success('导入完成', {
        description: `成功 ${successCount} 条${skipCount > 0 ? `，跳过 ${skipCount} 条` : ''}${errorCount > 0 ? `，失败 ${errorCount} 条` : ''}`,
      });
      fetchQuotas();
    }

    if (errors.length > 0) {
      setQuotaImportErrors(errors);
    } else {
      setQuotaImportDialogOpen(false);
    }
  }, [quotaImportData, quotaImportType, fetchQuotas]);

  // 下载导入模板
  const handleDownloadTemplate = useCallback((type: 'selfConstruction' | 'intelligent') => {
    const isSelf = type === 'selfConstruction';
    const headers = isSelf
      ? ['编号', '分类', '名称', '单位', '数量', '单价', '备注']
      : ['编号', '序号', '分类', '名称', '品牌型号', '描述', '可抵扣税率', '单位', '单价', '备注'];

    const sampleRows = isSelf
      ? [
          ['1', '宽带、专线项目', '光缆布放', '米', 1, 1.65, '施工测量、做拉线'],
          ['2', '常规内部布线', '网线布放', '米', 1, 3.5, '含网线材料'],
        ]
      : [
          ['I-1', 1, '设备', '高清摄像头', '海康威视DS-2CD3T46', '400万像素', 13, '台', 800, '含安装'],
          ['I-2', 2, '施工安装', '摄像机安装', '', '包括定位、固定、接线', 6, '台', 150, '含辅料'],
        ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

    // 设置列宽
    ws['!cols'] = headers.map(() => ({ wch: 16 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isSelf ? '自施工定额' : '智能化定额');
    XLSX.writeFile(wb, isSelf ? '自施工定额导入模板.xlsx' : '智能化定额导入模板.xlsx');
  }, []);

  // 加载报价单列表
  const fetchQuotes = useCallback(async (page: number = 1, keyword: string = '', status: string = 'all') => {
    setIsLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (keyword) params.set('keyword', keyword);
      if (status && status !== 'all') params.set('status', status);

      const response = await fetch(`/api/engineering-quotes?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setQuotes(result.data || []);
        setTotalPages(result.pagination?.totalPages || 1);
        setTotalCount(result.pagination?.total || 0);
        setCurrentPage(page);
        setSelectedIds(new Set()); // 切换页面时清空选中
      } else {
        toast.error('加载失败', { description: result.error || '无法获取报价列表' });
      }
    } catch (error) {
      console.error('加载报价列表失败:', error);
      toast.error('加载失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsLoadingList(false);
    }
  }, [pageSize]);

  // 切换到列表Tab时加载数据
  useEffect(() => {
    if (activeTab === 'list') {
      fetchQuotes(1, searchKeyword, statusFilter);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换到统计Tab时加载数据
  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换到定额库Tab时加载数据
  useEffect(() => {
    if (activeTab === 'quotas') {
      fetchQuotas();
      fetchQuotaCategories();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载报价单到编辑表单（从后端获取最新数据）
  const handleLoadQuote = async (quote: EngineeringQuote) => {
    try {
      const response = await fetch(`/api/engineering-quotes/${quote.id}`);
      const result = await response.json();

      if (!result.success) {
        toast.error('加载失败', { description: result.error || '获取报价详情失败' });
        return;
      }

      const data: EngineeringQuote = result.data;
      setCustomerName(data.client_name || '');
      setProjectName(data.project_name);
      setContactPerson(data.contact_person || '');
      setContactPhone(data.contact_phone || '');
      setManagementFeeRate(data.management_rate || 8);
      setProfitRate(data.profit_rate || 10);
      setRegulatoryFeeRate(data.regulatory_rate || 3);
      setSavedQuoteId(data.id);
      setLastSavedAt(new Date(data.updated_at).toLocaleString('zh-CN'));

      // 恢复报价明细
      if (data.items && Array.isArray(data.items)) {
        const loadedItems: QuoteItem[] = data.items.map((item: any, index: number) => ({
          id: index + 1,
          itemType: item.itemType as 'selfConstruction' | 'intelligent',
          itemId: item.itemId,
          quantity: item.quantity,
        }));
        setQuoteItems(loadedItems);
        setNextItemId(loadedItems.length + 1);
      } else {
        setQuoteItems([]);
        setNextItemId(1);
      }

      quoteRandomRef.current = Math.floor(Math.random() * 1000);
      setActiveTab('create');
      toast.success('加载成功', { description: `已加载报价单 ${data.quote_number}` });
    } catch (error) {
      console.error('加载报价单失败:', error);
      toast.error('加载失败', { description: '网络错误，请稍后重试' });
    }
  };

  // 打开删除确认对话框
  const handleOpenDeleteDialog = (quote: EngineeringQuote) => {
    setDeleteTarget(quote);
    setDeletePassword('');
    setDeleteDialogOpen(true);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (!deletePassword) {
      toast.error('请输入管理密码');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/engineering-quotes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id, password: deletePassword }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success('删除成功', { description: `报价单 ${deleteTarget.quote_number} 已删除` });
        setDeleteDialogOpen(false);
        fetchQuotes(currentPage, searchKeyword, statusFilter);
      } else {
        toast.error('删除失败', { description: result.error || '请稍后重试' });
      }
    } catch (error) {
      console.error('删除报价单失败:', error);
      toast.error('删除失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsDeleting(false);
    }
  };

  // 打开状态变更对话框
  const handleOpenStatusDialog = (quote: EngineeringQuote) => {
    setStatusTarget(quote);
    setNewStatus(quote.status);
    setStatusDialogOpen(true);
  };

  // 确认状态变更
  const handleConfirmStatusChange = async () => {
    if (!statusTarget || !newStatus) return;

    setIsChangingStatus(true);
    try {
      const response = await fetch(`/api/engineering-quotes/${statusTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();

      if (result.success) {
        const statusLabels: Record<string, string> = {
          draft: '草稿',
          submitted: '已提交',
          approved: '已审批',
          rejected: '已驳回',
        };
        toast.success('状态变更成功', {
          description: `报价单 ${statusTarget.quote_number} 已变更为「${statusLabels[newStatus] || newStatus}」`,
        });
        setStatusDialogOpen(false);
        fetchQuotes(currentPage, searchKeyword, statusFilter);
      } else {
        toast.error('状态变更失败', { description: result.error || '请稍后重试' });
      }
    } catch (error) {
      console.error('状态变更失败:', error);
      toast.error('状态变更失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsChangingStatus(false);
    }
  };

  // 搜索
  const handleSearch = () => {
    setCurrentPage(1);
    fetchQuotes(1, searchKeyword, statusFilter);
  };

  // 状态筛选
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    fetchQuotes(1, searchKeyword, status);
  };

  // 分页跳转
  const handlePageChange = (page: number) => {
    fetchQuotes(page, searchKeyword, statusFilter);
  };

  // 渲染分页
  const renderPagination = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
              className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          {pages.map((page, index) =>
            page === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={currentPage === page}
                  onClick={() => handlePageChange(page)}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
              className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  // 构建工程报价导出数据
  const buildExportData = useCallback((): EngineeringQuoteExportData | null => {
    if (quoteItems.length === 0) return null;

    // 自行计算汇总数据，避免依赖后定义的 totals
    let totalBase = 0;
    quoteItems.forEach(item => {
      const quotaItem = item.itemType === 'selfConstruction'
        ? SELF_CONSTRUCTION_QUOTA.find(q => q.id === item.itemId)
        : INTELLIGENT_PROJECT_QUOTA.find(q => q.id === item.itemId);
      if (quotaItem) {
        totalBase += quotaItem.price * item.quantity;
      }
    });

    const subtotal = totalBase;
    const managementFee = subtotal * (managementFeeRate / 100);
    const profit = subtotal * (profitRate / 100);
    const regulatoryFee = subtotal * (regulatoryFeeRate / 100);
    const taxAmount = (subtotal + managementFee + profit + regulatoryFee) * 0.13;
    const grandTotal = subtotal + managementFee + profit + regulatoryFee + taxAmount;

    // 自行生成报价单号
    const quoteNumber = `GC${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(quoteRandomRef.current).padStart(3, '0')}`;

    return {
      projectName,
      clientName: customerName,
      contactPerson,
      contactPhone,
      quoteNumber,
      quoteDate: new Date().toISOString().split('T')[0],
      items: quoteItems.map(item => {
        const quotaItem = item.itemType === 'selfConstruction'
          ? SELF_CONSTRUCTION_QUOTA.find(q => q.id === item.itemId)
          : INTELLIGENT_PROJECT_QUOTA.find(q => q.id === item.itemId);
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
        subtotal,
        managementFee,
        profit,
        regulatoryFee,
        tax: taxAmount,
        grandTotal,
        grandTotalRMB: convertToChineseCurrency(grandTotal),
      },
    };
  }, [quoteItems, projectName, customerName, contactPhone, managementFeeRate, profitRate, regulatoryFeeRate]); // eslint-disable-line react-hooks/exhaustive-deps

  // 预览当前编辑的报价单
  const handlePreview = useCallback(() => {
    if (quoteItems.length === 0) {
      toast.error('预览失败', { description: '请至少添加一条报价明细' });
      return;
    }
    if (!projectName) {
      toast.error('预览失败', { description: '请填写项目名称' });
      return;
    }

    const exportData = buildExportData();
    if (!exportData) return;

    const html = generateEngineeringQuoteHTML(exportData);
    setPreviewHtml(html);
    setPreviewTitle(`${exportData.projectName} - ${exportData.quoteNumber}`);
    setPreviewDialogOpen(true);
  }, [quoteItems.length, projectName, buildExportData]);

  // 从列表预览报价单（从后端获取最新数据）
  const handlePreviewFromList = useCallback(async (quote: EngineeringQuote) => {
    try {
      const response = await fetch(`/api/engineering-quotes/${quote.id}`);
      const result = await response.json();

      if (!result.success) {
        toast.error('预览失败', { description: result.error || '获取报价详情失败' });
        return;
      }

      const data: EngineeringQuote = result.data;
      // 数据库返回的数值字段可能是字符串，统一转为数字
      const num = (v: any) => Number(v) || 0;

      const exportData: EngineeringQuoteExportData = {
        projectName: data.project_name,
        clientName: data.client_name || '',
        contactPerson: data.contact_person || '',
        contactPhone: data.contact_phone || '',
        quoteNumber: data.quote_number,
        quoteDate: new Date(data.created_at).toISOString().split('T')[0],
        items: (data.items || []).map(item => ({
          name: item.name,
          unit: item.unit,
          quantity: num(item.quantity),
          unitPrice: num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100),
          amount: num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100) * num(item.quantity),
        })),
        rates: {
          managementRate: num(data.management_rate),
          profitRate: num(data.profit_rate),
          regulatoryRate: num(data.regulatory_rate),
          taxRate: num(data.tax_rate),
        },
        summary: {
          subtotal: num(data.subtotal),
          managementFee: num(data.management_fee),
          profit: num(data.profit),
          regulatoryFee: num(data.regulatory_fee),
          tax: num(data.tax),
          grandTotal: num(data.total),
          grandTotalRMB: convertToChineseCurrency(num(data.total)),
        },
      };

      const html = generateEngineeringQuoteHTML(exportData);
      setPreviewHtml(html);
      setPreviewTitle(`${data.project_name} - ${data.quote_number}`);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error('预览报价单失败:', error);
      toast.error('预览失败', { description: '网络错误，请稍后重试' });
    }
  }, []);

  // 从预览导出Word
  const handleExportFromPreview = useCallback(() => {
    if (!previewHtml) return;
    const quoteNumber = previewTitle.split(' - ').pop() || 'unknown';
    downloadAsWord(previewHtml, `工程报价单_${quoteNumber}.doc`);
  }, [previewHtml, previewTitle]);

  // 切换选中状态
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === quotes.length && quotes.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(quotes.map(q => q.id)));
    }
  }, [selectedIds.size, quotes]);

  // 批量导出为Word（逐个下载）
  const handleBatchExportWord = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('请先选择报价单', { description: '勾选需要导出的报价单后再点击批量导出' });
      return;
    }

    setIsBatchExporting(true);
    try {
      const response = await fetch('/api/engineering-quotes/batch-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const result = await response.json();

      if (!result.success) {
        toast.error('批量导出失败', { description: result.error || '获取报价数据失败' });
        return;
      }

      const quoteList: EngineeringQuote[] = result.data;
      const num = (v: any) => Number(v) || 0;

      let exportedCount = 0;
      for (const data of quoteList) {
        const exportData: EngineeringQuoteExportData = {
          projectName: data.project_name,
          clientName: data.client_name || '',
          contactPerson: data.contact_person || '',
          contactPhone: data.contact_phone || '',
          quoteNumber: data.quote_number,
          quoteDate: new Date(data.created_at).toISOString().split('T')[0],
          items: (data.items || []).map(item => ({
            name: item.name,
            unit: item.unit,
            quantity: num(item.quantity),
            unitPrice: num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100),
            amount: num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100) * num(item.quantity),
          })),
          rates: {
            managementRate: num(data.management_rate),
            profitRate: num(data.profit_rate),
            regulatoryRate: num(data.regulatory_rate),
            taxRate: num(data.tax_rate),
          },
          summary: {
            subtotal: num(data.subtotal),
            managementFee: num(data.management_fee),
            profit: num(data.profit),
            regulatoryFee: num(data.regulatory_fee),
            tax: num(data.tax),
            grandTotal: num(data.total),
            grandTotalRMB: convertToChineseCurrency(num(data.total)),
          },
        };

        const html = generateEngineeringQuoteHTML(exportData);
        downloadAsWord(html, `工程报价单_${data.quote_number}.doc`);
        exportedCount++;

        // 每个文件间隔300ms下载，避免浏览器拦截
        if (exportedCount < quoteList.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      toast.success('批量导出成功', { description: `已导出 ${exportedCount} 份报价单（Word格式）` });
    } catch (error) {
      console.error('批量导出失败:', error);
      toast.error('批量导出失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsBatchExporting(false);
    }
  }, [selectedIds]);

  // 批量导出为Excel
  const handleBatchExportExcel = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('请先选择报价单', { description: '勾选需要导出的报价单后再点击批量导出' });
      return;
    }

    setIsBatchExporting(true);
    try {
      const response = await fetch('/api/engineering-quotes/batch-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const result = await response.json();

      if (!result.success) {
        toast.error('批量导出失败', { description: result.error || '获取报价数据失败' });
        return;
      }

      const quoteList: EngineeringQuote[] = result.data;
      const num = (v: any) => Number(v) || 0;

      const wb = XLSX.utils.book_new();

      // 汇总表
      const summaryData = quoteList.map((data, idx) => ({
        '序号': idx + 1,
        '报价单号': data.quote_number,
        '项目名称': data.project_name,
        '客户名称': data.client_name || '',
        '联系人': data.contact_person || '',
        '联系电话': data.contact_phone || '',
        '直接工程费': num(data.subtotal),
        '管理费': num(data.management_fee),
        '利润': num(data.profit),
        '规费': num(data.regulatory_fee),
        '税金': num(data.tax),
        '报价总额': num(data.total),
        '状态': data.status === 'draft' ? '草稿' : data.status === 'submitted' ? '已提交' : data.status === 'approved' ? '已审批' : data.status === 'rejected' ? '已驳回' : data.status,
        '创建时间': new Date(data.created_at).toLocaleString('zh-CN'),
      }));
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      summaryWs['!cols'] = [
        { wch: 6 }, { wch: 20 }, { wch: 24 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
        { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
        { wch: 8 }, { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, summaryWs, '报价汇总');

      // 每个报价单一个明细sheet
      for (const data of quoteList) {
        const sheetName = data.quote_number.substring(0, 31); // Excel sheet名最长31字符
        const detailData: Record<string, string | number>[] = (data.items || []).map((item, idx) => ({
          '序号': idx + 1,
          '项目名称': item.name,
          '单位': item.unit,
          '数量': num(item.quantity),
          '单价（元）': num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100),
          '金额（元）': num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100) * num(item.quantity),
        }));

        // 追加汇总行
        detailData.push({ '序号': '', '项目名称': '直接工程费小计', '单位': '', '数量': '', '单价（元）': '', '金额（元）': num(data.subtotal) });
        detailData.push({ '序号': '', '项目名称': `管理费（${num(data.management_rate)}%）`, '单位': '', '数量': '', '单价（元）': '', '金额（元）': num(data.management_fee) });
        detailData.push({ '序号': '', '项目名称': `利润（${num(data.profit_rate)}%）`, '单位': '', '数量': '', '单价（元）': '', '金额（元）': num(data.profit) });
        detailData.push({ '序号': '', '项目名称': `规费（${num(data.regulatory_rate)}%）`, '单位': '', '数量': '', '单价（元）': '', '金额（元）': num(data.regulatory_fee) });
        detailData.push({ '序号': '', '项目名称': `增值税（${num(data.tax_rate)}%）`, '单位': '', '数量': '', '单价（元）': '', '金额（元）': num(data.tax) });
        detailData.push({ '序号': '', '项目名称': '报价总计', '单位': '', '数量': '', '单价（元）': '', '金额（元）': num(data.total) });

        const detailWs = XLSX.utils.json_to_sheet(detailData);
        detailWs['!cols'] = [
          { wch: 6 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, detailWs, sheetName);
      }

      XLSX.writeFile(wb, `工程报价批量导出_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('批量导出成功', { description: `已导出 ${quoteList.length} 份报价单（Excel格式）` });
    } catch (error) {
      console.error('批量导出失败:', error);
      toast.error('批量导出失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsBatchExporting(false);
    }
  }, [selectedIds]);

  // 批量导出为PDF（逐个下载）
  const handleBatchExportPDF = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('请先选择报价单', { description: '勾选需要导出的报价单后再点击批量导出' });
      return;
    }

    setIsBatchExporting(true);
    try {
      const response = await fetch('/api/engineering-quotes/batch-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const result = await response.json();

      if (!result.success) {
        toast.error('批量导出失败', { description: result.error || '获取报价数据失败' });
        return;
      }

      const quoteList: EngineeringQuote[] = result.data;
      const num = (v: any) => Number(v) || 0;

      let exportedCount = 0;
      for (const data of quoteList) {
        const exportData: EngineeringQuoteExportData = {
          projectName: data.project_name,
          clientName: data.client_name || '',
          contactPerson: data.contact_person || '',
          contactPhone: data.contact_phone || '',
          quoteNumber: data.quote_number,
          quoteDate: new Date(data.created_at).toISOString().split('T')[0],
          items: (data.items || []).map(item => ({
            name: item.name,
            unit: item.unit,
            quantity: num(item.quantity),
            unitPrice: num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100),
            amount: num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100) * num(item.quantity),
          })),
          rates: {
            managementRate: num(data.management_rate),
            profitRate: num(data.profit_rate),
            regulatoryRate: num(data.regulatory_rate),
            taxRate: num(data.tax_rate),
          },
          summary: {
            subtotal: num(data.subtotal),
            managementFee: num(data.management_fee),
            profit: num(data.profit),
            regulatoryFee: num(data.regulatory_fee),
            tax: num(data.tax),
            grandTotal: num(data.total),
            grandTotalRMB: convertToChineseCurrency(num(data.total)),
          },
        };

        const html = generateEngineeringQuoteHTML(exportData);
        await downloadAsPDF(html, `工程报价单_${data.quote_number}.pdf`);
        exportedCount++;

        // 每个文件间隔500ms下载，避免浏览器拦截和html2pdf渲染冲突
        if (exportedCount < quoteList.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      toast.success('批量导出成功', { description: `已导出 ${exportedCount} 份报价单（PDF格式）` });
    } catch (error) {
      console.error('批量导出PDF失败:', error);
      toast.error('批量导出失败', { description: 'PDF生成出错，请稍后重试' });
    } finally {
      setIsBatchExporting(false);
    }

  }, [selectedIds]);

  // 打开报价对比对话框（从列表选择第一份）
  const handleOpenCompare = useCallback((quote: EngineeringQuote) => {
    setCompareQuoteA(quote);
    setCompareQuoteB(null);
    setCompareDataA(null);
    setCompareDataB(null);
    setCompareDialogOpen(true);
  }, []);

  // 执行报价对比
  const handleExecuteCompare = useCallback(async () => {
    if (!compareQuoteA || !compareQuoteB) {
      toast.error('请选择两份报价单', { description: '需要选择两份报价单才能进行对比' });
      return;
    }
    if (compareQuoteA.id === compareQuoteB.id) {
      toast.error('不能对比同一份报价单', { description: '请选择两份不同的报价单' });
      return;
    }

    setIsLoadingCompare(true);
    try {
      const response = await fetch('/api/engineering-quotes/batch-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [compareQuoteA.id, compareQuoteB.id] }),
      });
      const result = await response.json();

      if (!result.success) {
        toast.error('对比失败', { description: result.error || '获取报价数据失败' });
        return;
      }

      const quoteList: EngineeringQuote[] = result.data;
      const dataA = quoteList.find(q => q.id === compareQuoteA.id) || null;
      const dataB = quoteList.find(q => q.id === compareQuoteB.id) || null;
      setCompareDataA(dataA);
      setCompareDataB(dataB);
    } catch (error) {
      console.error('报价对比失败:', error);
      toast.error('对比失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsLoadingCompare(false);
    }
  }, [compareQuoteA, compareQuoteB]);

  // 对比明细项合并：按名称+单位匹配，找出差异
  const getMergedItems = useCallback(() => {
    if (!compareDataA || !compareDataB) return [];
    const itemsA = compareDataA.items || [];
    const itemsB = compareDataB.items || [];
    const num = (v: any) => Number(v) || 0;

    // 用 Map 按 name+unit 做合并
    const mapA = new Map<string, typeof itemsA[0]>();
    itemsA.forEach(item => mapA.set(`${item.name}__${item.unit}`, item));
    const mapB = new Map<string, typeof itemsB[0]>();
    itemsB.forEach(item => mapB.set(`${item.name}__${item.unit}`, item));

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    const merged = Array.from(allKeys).map(key => {
      const a = mapA.get(key);
      const b = mapB.get(key);
      const unitPriceA = a ? num(a.price) * (1 + num(compareDataA.management_rate) / 100 + num(compareDataA.profit_rate) / 100 + num(compareDataA.regulatory_rate) / 100) : 0;
      const unitPriceB = b ? num(b.price) * (1 + num(compareDataB.management_rate) / 100 + num(compareDataB.profit_rate) / 100 + num(compareDataB.regulatory_rate) / 100) : 0;
      const amountA = a ? unitPriceA * num(a.quantity) : 0;
      const amountB = b ? unitPriceB * num(b.quantity) : 0;
      return {
        name: (a || b)!.name,
        unit: (a || b)!.unit,
        onlyInA: !!a && !b,
        onlyInB: !a && !!b,
        quantityA: a ? num(a.quantity) : null,
        quantityB: b ? num(b.quantity) : null,
        priceA: a ? num(a.price) : null,
        priceB: b ? num(b.price) : null,
        unitPriceA,
        unitPriceB,
        amountA,
        amountB,
        diffAmount: amountB - amountA,
      };
    });

    // 排序：先共有项，再A独有，再B独有
    merged.sort((a, b) => {
      if (a.onlyInA && !b.onlyInA) return 1;
      if (!a.onlyInA && b.onlyInA) return -1;
      if (a.onlyInB && !b.onlyInB) return 1;
      if (!a.onlyInB && b.onlyInB) return -1;
      return 0;
    });

    return merged;
  }, [compareDataA, compareDataB]);

  // 打开分享对话框
  const handleOpenShareDialog = (quote: EngineeringQuote) => {
    setShareTarget(quote);
    setSharePassword('');
    setShareExpiresDays(7);
    setShareMaxViews(0);
    setShareRemark('');
    setShareResult(null);
    setShareCopied(false);
    setShareDialogOpen(true);
  };

  // 创建分享链接
  const handleCreateShare = useCallback(async () => {
    if (!shareTarget) return;
    setIsCreatingShare(true);
    try {
      const response = await fetch('/api/quote-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: shareTarget.id,
          password: sharePassword || null,
          expiresInDays: shareExpiresDays,
          maxViews: shareMaxViews,
          remark: shareRemark || null,
        }),
      });
      const result = await response.json();

      if (result.success) {
        const fullUrl = `${window.location.origin}${result.data.shareUrl}`;
        setShareResult({ shareUrl: fullUrl, shareToken: result.data.shareToken });
        toast.success('分享链接已创建');
      } else {
        toast.error('创建分享链接失败', { description: result.error || '请稍后重试' });
      }
    } catch (error) {
      console.error('创建分享链接失败:', error);
      toast.error('创建分享链接失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsCreatingShare(false);
    }
  }, [shareTarget, sharePassword, shareExpiresDays, shareMaxViews, shareRemark]);

  // 复制分享链接
  const handleCopyShareUrl = useCallback(async () => {
    if (!shareResult) return;
    try {
      await navigator.clipboard.writeText(shareResult.shareUrl);
      setShareCopied(true);
      toast.success('链接已复制到剪贴板');
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = shareResult.shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setShareCopied(true);
      toast.success('链接已复制到剪贴板');
      setTimeout(() => setShareCopied(false), 2000);
    }
  }, [shareResult]);

  // 打开分享记录管理对话框
  const handleOpenShareList = useCallback(async (quote: EngineeringQuote) => {
    setShareTarget(quote);
    setShareListDialogOpen(true);
    setIsLoadingShareList(true);
    try {
      const response = await fetch(`/api/quote-shares?quoteId=${quote.id}`);
      const result = await response.json();
      if (result.success) {
        setShareList(result.data);
      } else {
        toast.error('获取分享记录失败', { description: result.error });
      }
    } catch (error) {
      console.error('获取分享记录失败:', error);
      toast.error('获取分享记录失败');
    } finally {
      setIsLoadingShareList(false);
    }
  }, []);

  // 停用分享链接
  const handleDeactivateShare = useCallback(async (shareId: number) => {
    try {
      const response = await fetch('/api/quote-shares', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: shareId }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('分享链接已停用');
        // 刷新分享列表
        if (shareTarget) {
          const listRes = await fetch(`/api/quote-shares?quoteId=${shareTarget.id}`);
          const listResult = await listRes.json();
          if (listResult.success) setShareList(listResult.data);
        }
      } else {
        toast.error('停用失败', { description: result.error });
      }
    } catch (error) {
      console.error('停用分享链接失败:', error);
      toast.error('停用失败');
    }
  }, [shareTarget]);

  // 获取状态徽章样式
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">草稿</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">已提交</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">已审批</Badge>;
      case 'rejected':
        return <Badge variant="destructive">已驳回</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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

  // 定额库分类与分页逻辑
  const [allQuotaCategories, setAllQuotaCategories] = useState<string[]>([]);
  const fetchQuotaCategories = useCallback(async () => {
    try {
      const [selfRes, intelligentRes] = await Promise.all([
        fetch('/api/self-construction-quotas?limit=9999'),
        fetch('/api/intelligent-project-quotas?limit=9999'),
      ]);
      const selfResult = await selfRes.json();
      const intelligentResult = await intelligentRes.json();
      const categories = Array.from(new Set([
        ...(selfResult.success ? selfResult.data.map((r: any) => r.category) : []),
        ...(intelligentResult.success ? intelligentResult.data.map((r: any) => r.category) : []),
      ]));
      setAllQuotaCategories(categories);
    } catch {
      // 静默失败
    }
  }, []);

  // 搜索/筛选变更时触发服务端重新请求
  useEffect(() => {
    if (activeTab === 'quotas') {
      fetchQuotas({ selfPage: 1, intelligentPage: 1 });
    }
  }, [quotaSearchKeyword, quotaCategoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // 定额库分页辅助函数
  const handleSelfConstructionPageChange = (page: number) => {
    fetchQuotas({ selfPage: page });
  };
  const handleIntelligentPageChange = (page: number) => {
    fetchQuotas({ intelligentPage: page });
  };

  // 渲染定额库分页
  const renderQuotaPagination = (
    currentPage: number,
    totalPages: number,
    total: number,
    onPageChange: (page: number) => void
  ) => {
    if (totalPages <= 1) return null;
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return (
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          共 {total} 条，第 {currentPage}/{totalPages} 页
        </span>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {pages.map((page, index) =>
              page === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    isActive={currentPage === page}
                    onClick={() => onPageChange(page)}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
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

  // 生成报价单号
  const generateQuoteNumber = () => {
    return `GC${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(quoteRandomRef.current).padStart(3, '0')}`;
  };

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!projectName) {
      toast.error('保存失败', {
        description: '请至少填写项目名称',
      });
      return;
    }

    setIsSaving(true);
    try {
      const quoteNumber = generateQuoteNumber();
      const payload = {
        quoteNumber: savedQuoteId ? undefined : quoteNumber,
        projectName,
        clientName: customerName,
        contactPerson,
        contactPhone,
        constructionArea: 0,
        managementRate: managementFeeRate,
        profitRate,
        regulatoryRate: regulatoryFeeRate,
        taxRate: 13,
        subtotal: totals.subtotal,
        managementFee: totals.managementFee,
        profit: totals.profit,
        regulatoryFee: totals.regulatoryFee,
        tax: totals.taxAmount,
        total: totals.total,
        items: quoteItems.map(item => {
          const quotaItem = getItemById(item.itemType, item.itemId);
          return {
            itemType: item.itemType,
            itemId: item.itemId,
            quantity: item.quantity,
            name: quotaItem?.name || '',
            unit: quotaItem?.unit || '',
            price: quotaItem?.price || 0,
          };
        }),
        status: 'draft',
      };

      let response;
      if (savedQuoteId) {
        // 更新已有草稿
        response = await fetch('/api/engineering-quotes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: savedQuoteId }),
        });
      } else {
        // 新建草稿
        response = await fetch('/api/engineering-quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();

      if (result.success) {
        if (!savedQuoteId) {
          setSavedQuoteId(result.data.id);
        }
        setLastSavedAt(new Date().toLocaleString('zh-CN'));
        toast.success('保存成功', {
          description: '草稿已保存',
        });
      } else {
        toast.error('保存失败', {
          description: result.error || '请稍后重试',
        });
      }
    } catch (error) {
      console.error('保存草稿失败:', error);
      toast.error('保存失败', {
        description: '网络错误，请稍后重试',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 导出工程报价单（Word）
  const handleExportEngineeringQuote = () => {
    const exportData = buildExportData();
    if (!exportData) return;

    const html = generateEngineeringQuoteHTML(exportData);
    downloadAsWord(html, `工程报价单_${exportData.quoteNumber}.doc`);
  };

  // 导出工程报价单（PDF）
  const handleExportPDF = async () => {
    if (quoteItems.length === 0) {
      toast.error('导出失败', { description: '请至少添加一条报价明细' });
      return;
    }
    if (!projectName) {
      toast.error('导出失败', { description: '请填写项目名称' });
      return;
    }

    const exportData = buildExportData();
    if (!exportData) return;

    setIsExportingPDF(true);
    try {
      const html = generateEngineeringQuoteHTML(exportData);
      await downloadAsPDF(html, `工程报价单_${exportData.quoteNumber}.pdf`);
      toast.success('导出成功', { description: 'PDF文件已开始下载' });
    } catch (error) {
      console.error('导出PDF失败:', error);
      toast.error('导出失败', { description: 'PDF生成出错，请稍后重试' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 从预览弹窗导出PDF
  const handleExportPDFFromPreview = async () => {
    if (!previewHtml) return;
    const quoteNumber = previewTitle.split(' - ').pop() || 'unknown';
    setIsExportingPDF(true);
    try {
      await downloadAsPDF(previewHtml, `工程报价单_${quoteNumber}.pdf`);
      toast.success('导出成功', { description: 'PDF文件已开始下载' });
    } catch (error) {
      console.error('导出PDF失败:', error);
      toast.error('导出失败', { description: 'PDF生成出错，请稍后重试' });
    } finally {
      setIsExportingPDF(false);
    }
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
          <TabsTrigger value="list">
            报价列表
            {totalCount > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {totalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="quotas">定额库管理</TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-1" />
            统计看板
          </TabsTrigger>
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
            <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {savedQuoteId && (
                  <span>报价单 ID: {savedQuoteId}</span>
                )}
                {lastSavedAt && (
                  <span className="ml-2">上次保存: {lastSavedAt}</span>
                )}
              </div>
              <div className="flex gap-4">
              <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? '保存中...' : '保存草稿'}
              </Button>
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-2" />
                预览报价单
              </Button>
              <Button variant="outline" onClick={handleExportPDF} disabled={isExportingPDF}>
                {isExportingPDF ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                {isExportingPDF ? '导出中...' : '导出PDF'}
              </Button>
              <Button 
                className="bg-green-700 hover:bg-green-800"
                onClick={handleExportEngineeringQuote}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                导出Word
              </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6 space-y-6">
          {/* 搜索与筛选 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="搜索项目名称、客户名称、报价单号..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-9 pr-8"
                    />
                    {searchKeyword && (
                      <button
                        onClick={() => {
                          setSearchKeyword('');
                          setCurrentPage(1);
                          fetchQuotes(1, '', statusFilter);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select value={statusFilter} onValueChange={handleStatusFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="状态筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="submitted">已提交</SelectItem>
                      <SelectItem value="approved">已审批</SelectItem>
                      <SelectItem value="rejected">已驳回</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleSearch}>
                    <Search className="h-4 w-4 mr-2" />
                    搜索
                  </Button>
                </div>
                <div className="flex gap-2">
                  {selectedIds.size > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBatchExportWord}
                        disabled={isBatchExporting}
                        className="text-blue-700 border-blue-300 hover:bg-blue-50"
                      >
                        {isBatchExporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                        )}
                        批量导出Word ({selectedIds.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBatchExportExcel}
                        disabled={isBatchExporting}
                        className="text-green-700 border-green-300 hover:bg-green-50"
                      >
                        {isBatchExporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        批量导出Excel ({selectedIds.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBatchExportPDF}
                        disabled={isBatchExporting}
                        className="text-red-700 border-red-300 hover:bg-red-50"
                      >
                        {isBatchExporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4 mr-2" />
                        )}
                        批量导出PDF ({selectedIds.size})
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchQuotes(currentPage, searchKeyword, statusFilter)}
                    disabled={isLoadingList}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingList ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-700 hover:bg-green-800"
                    onClick={() => {
                      setSavedQuoteId(null);
                      setCustomerName('');
                      setProjectName('');
                      setContactPerson('');
                      setContactPhone('');
                      setManagementFeeRate(8);
                      setProfitRate(10);
                      setRegulatoryFeeRate(3);
                      setQuoteItems([]);
                      setNextItemId(1);
                      setLastSavedAt(null);
                      setActiveTab('create');
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    新建报价
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 报价列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                报价单列表
              </CardTitle>
              <CardDescription>
                共 {totalCount} 条记录，当前第 {currentPage}/{totalPages} 页
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingList ? (
                /* 加载骨架屏 */
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="h-4 w-[180px]" />
                      <Skeleton className="h-4 w-[120px]" />
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="h-4 w-[80px]" />
                      <Skeleton className="h-4 w-[60px]" />
                    </div>
                  ))}
                </div>
              ) : quotes.length === 0 ? (
                /* 空状态 */
                <Empty className="border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ClipboardList />
                    </EmptyMedia>
                    <EmptyTitle>暂无报价记录</EmptyTitle>
                    <EmptyDescription>
                      {searchKeyword || statusFilter !== 'all'
                        ? '没有找到匹配的报价单，请调整搜索条件'
                        : '点击上方「新建报价」按钮创建第一份报价单'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                /* 列表表格 */
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={quotes.length > 0 && selectedIds.size === quotes.length}
                              onCheckedChange={toggleSelectAll}
                              aria-label="全选"
                            />
                          </TableHead>
                          <TableHead className="w-[120px]">报价单号</TableHead>
                          <TableHead>项目名称</TableHead>
                          <TableHead className="w-[120px]">客户名称</TableHead>
                          <TableHead className="w-[100px]">报价总额</TableHead>
                          <TableHead className="w-[80px]">状态</TableHead>
                          <TableHead className="w-[160px]">创建时间</TableHead>
                          <TableHead className="w-[160px]">更新时间</TableHead>
                          <TableHead className="w-[80px] text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotes.map((quote) => (
                          <TableRow key={quote.id} className={selectedIds.has(quote.id) ? 'bg-muted/50' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(quote.id)}
                                onCheckedChange={() => toggleSelect(quote.id)}
                                aria-label={`选择 ${quote.quote_number}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {quote.quote_number}
                            </TableCell>
                            <TableCell className="font-medium">
                              {quote.project_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {quote.client_name || '-'}
                            </TableCell>
                            <TableCell className="font-semibold">
                              ¥{Number(quote.total).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(quote.status)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(quote.created_at).toLocaleString('zh-CN')}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(quote.updated_at).toLocaleString('zh-CN')}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handlePreviewFromList(quote)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    预览
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleLoadQuote(quote)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    编辑加载
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenCompare(quote)}>
                                    <ClipboardList className="h-4 w-4 mr-2" />
                                    报价对比
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenStatusDialog(quote)}>
                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                    变更状态
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenShareDialog(quote)}>
                                    <Share2 className="h-4 w-4 mr-2" />
                                    生成分享链接
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenShareList(quote)}>
                                    <Link2 className="h-4 w-4 mr-2" />
                                    分享记录
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleOpenDeleteDialog(quote)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="mt-4 flex justify-center">
                      {renderPagination()}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* 删除确认对话框 */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除报价单</DialogTitle>
                <DialogDescription>
                  您正在删除报价单「{deleteTarget?.quote_number} - {deleteTarget?.project_name}」，此操作不可撤销。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">报价单号：</span>
                      <span className="font-mono">{deleteTarget?.quote_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">项目名称：</span>
                      <span>{deleteTarget?.project_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">客户名称：</span>
                      <span>{deleteTarget?.client_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">报价总额：</span>
                      <span className="font-semibold">¥{deleteTarget ? Number(deleteTarget.total).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deletePassword">管理密码</Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    placeholder="请输入管理密码以确认删除"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmDelete()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={isDeleting}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting || !deletePassword}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      确认删除
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 状态变更对话框 */}
          <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>变更报价单状态</DialogTitle>
                <DialogDescription>
                  修改报价单「{statusTarget?.quote_number} - {statusTarget?.project_name}」的状态
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">报价单号：</span>
                      <span className="font-mono">{statusTarget?.quote_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">项目名称：</span>
                      <span>{statusTarget?.project_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">当前状态：</span>
                      {statusTarget && getStatusBadge(statusTarget.status)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">报价总额：</span>
                      <span className="font-semibold">¥{statusTarget ? Number(statusTarget.total).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>变更至</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择目标状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">
                        <span className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">草稿</Badge>
                        </span>
                      </SelectItem>
                      <SelectItem value="submitted">
                        <span className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">已提交</Badge>
                        </span>
                      </SelectItem>
                      <SelectItem value="approved">
                        <span className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">已审批</Badge>
                        </span>
                      </SelectItem>
                      <SelectItem value="rejected">
                        <span className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">已驳回</Badge>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setStatusDialogOpen(false)}
                  disabled={isChangingStatus}
                >
                  取消
                </Button>
                <Button
                  onClick={handleConfirmStatusChange}
                  disabled={isChangingStatus || !newStatus || newStatus === statusTarget?.status}
                >
                  {isChangingStatus ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      变更中...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      确认变更
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 报价对比 - 全页面 */}
          {compareDialogOpen && (
            <div className="fixed inset-0 z-50 bg-background flex flex-col">
              {/* 顶部栏 */}
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-purple-600" />
                    <h2 className="text-lg font-semibold">报价对比</h2>
                    <span className="text-sm text-muted-foreground">— 选择两份报价单进行差异对比（明细项、费率、总价）</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => {
                    setCompareQuoteA(null);
                    setCompareQuoteB(null);
                    setCompareDataA(null);
                    setCompareDataB(null);
                    setCompareDialogOpen(false);
                  }}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* 内容区域 - 可滚动 */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
              {/* 选择报价单 */}
              {!compareDataA || !compareDataB ? (
                <div className="space-y-6 max-w-5xl mx-auto py-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 报价单 A */}
                    <Card className={compareQuoteA ? 'border-blue-200 bg-blue-50/30' : ''}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">A</span>
                          报价单 A
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {compareQuoteA ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">报价单号</span>
                              <span className="font-mono">{compareQuoteA.quote_number}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">项目名称</span>
                              <span className="font-medium">{compareQuoteA.project_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">客户名称</span>
                              <span>{compareQuoteA.client_name || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">报价总额</span>
                              <span className="font-semibold text-blue-700">¥{Number(compareQuoteA.total).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => { setCompareQuoteA(null); }}>
                              <X className="h-3 w-3 mr-1" /> 取消选择
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">从列表中选择报价单A</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* 报价单 B */}
                    <Card className={compareQuoteB ? 'border-orange-200 bg-orange-50/30' : ''}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">B</span>
                          报价单 B
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {compareQuoteB ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">报价单号</span>
                              <span className="font-mono">{compareQuoteB.quote_number}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">项目名称</span>
                              <span className="font-medium">{compareQuoteB.project_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">客户名称</span>
                              <span>{compareQuoteB.client_name || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">报价总额</span>
                              <span className="font-semibold text-orange-700">¥{Number(compareQuoteB.total).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => { setCompareQuoteB(null); }}>
                              <X className="h-3 w-3 mr-1" /> 取消选择
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground text-center py-2">从下方列表选择报价单B</p>
                            <Select onValueChange={(val) => {
                              const found = quotes.find(q => q.id === Number(val));
                              if (found) setCompareQuoteB(found);
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="选择报价单..." />
                              </SelectTrigger>
                              <SelectContent>
                                {quotes.filter(q => q.id !== compareQuoteA?.id).map(q => (
                                  <SelectItem key={q.id} value={String(q.id)}>
                                    {q.quote_number} - {q.project_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={handleExecuteCompare}
                      disabled={!compareQuoteA || !compareQuoteB || isLoadingCompare}
                      className="px-8"
                    >
                      {isLoadingCompare ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                      )}
                      开始对比
                    </Button>
                  </div>
                </div>
              ) : (
                /* 对比结果 */
                <div className="space-y-6 max-w-6xl mx-auto py-2">
                  {(() => {
                    const num = (v: any) => Number(v) || 0;
                    const mergedItems = getMergedItems();
                    const totalDiff = num(compareDataB.total) - num(compareDataA.total);
                    const totalDiffPercent = num(compareDataA.total) > 0 ? ((totalDiff / num(compareDataA.total)) * 100).toFixed(2) : '0.00';

                    return (
                      <>
                        {/* 基本信息对比 */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">基本信息对比</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[140px]">对比项</TableHead>
                                  <TableHead className="text-center">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">A</span>
                                      {compareDataA.quote_number}
                                    </span>
                                  </TableHead>
                                  <TableHead className="text-center">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">B</span>
                                      {compareDataB.quote_number}
                                    </span>
                                  </TableHead>
                                  <TableHead className="text-center w-[120px]">差异</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="text-muted-foreground">项目名称</TableCell>
                                  <TableCell className="text-center">{compareDataA.project_name}</TableCell>
                                  <TableCell className="text-center">{compareDataB.project_name}</TableCell>
                                  <TableCell className="text-center">
                                    {compareDataA.project_name !== compareDataB.project_name && (
                                      <Badge variant="outline" className="text-yellow-700 border-yellow-300">不同</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="text-muted-foreground">客户名称</TableCell>
                                  <TableCell className="text-center">{compareDataA.client_name || '-'}</TableCell>
                                  <TableCell className="text-center">{compareDataB.client_name || '-'}</TableCell>
                                  <TableCell className="text-center">
                                    {(compareDataA.client_name || '') !== (compareDataB.client_name || '') && (
                                      <Badge variant="outline" className="text-yellow-700 border-yellow-300">不同</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="text-muted-foreground">联系人</TableCell>
                                  <TableCell className="text-center">{compareDataA.contact_person || '-'}</TableCell>
                                  <TableCell className="text-center">{compareDataB.contact_person || '-'}</TableCell>
                                  <TableCell className="text-center">
                                    {(compareDataA.contact_person || '') !== (compareDataB.contact_person || '') && (
                                      <Badge variant="outline" className="text-yellow-700 border-yellow-300">不同</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>

                        {/* 费率对比 */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">费率对比</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[140px]">费率项</TableHead>
                                  <TableHead className="text-center text-blue-700">报价单 A</TableHead>
                                  <TableHead className="text-center text-orange-700">报价单 B</TableHead>
                                  <TableHead className="text-center w-[120px]">差异</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {[
                                  { label: '管理费率', key: 'management_rate', suffix: '%' },
                                  { label: '利润率', key: 'profit_rate', suffix: '%' },
                                  { label: '规费率', key: 'regulatory_rate', suffix: '%' },
                                  { label: '增值税率', key: 'tax_rate', suffix: '%' },
                                ].map(({ label, key, suffix }) => {
                                  const valA = num((compareDataA as any)[key]);
                                  const valB = num((compareDataB as any)[key]);
                                  const diff = valB - valA;
                                  return (
                                    <TableRow key={key}>
                                      <TableCell className="text-muted-foreground">{label}</TableCell>
                                      <TableCell className="text-center font-mono">{valA}{suffix}</TableCell>
                                      <TableCell className="text-center font-mono">{valB}{suffix}</TableCell>
                                      <TableCell className="text-center">
                                        {diff !== 0 ? (
                                          <span className={diff > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                                            {diff > 0 ? '+' : ''}{diff}{suffix}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">相同</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>

                        {/* 总价对比 */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">总价对比</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[140px]">费用项</TableHead>
                                  <TableHead className="text-center text-blue-700">报价单 A</TableHead>
                                  <TableHead className="text-center text-orange-700">报价单 B</TableHead>
                                  <TableHead className="text-center w-[120px]">差异</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {[
                                  { label: '直接工程费', keyA: 'subtotal', keyB: 'subtotal' },
                                  { label: '管理费', keyA: 'management_fee', keyB: 'management_fee' },
                                  { label: '利润', keyA: 'profit', keyB: 'profit' },
                                  { label: '规费', keyA: 'regulatory_fee', keyB: 'regulatory_fee' },
                                  { label: '税金', keyA: 'tax', keyB: 'tax' },
                                ].map(({ label, keyA, keyB }) => {
                                  const valA = num((compareDataA as any)[keyA]);
                                  const valB = num((compareDataB as any)[keyB]);
                                  const diff = valB - valA;
                                  return (
                                    <TableRow key={label}>
                                      <TableCell className="text-muted-foreground">{label}</TableCell>
                                      <TableCell className="text-center font-mono">¥{valA.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                                      <TableCell className="text-center font-mono">¥{valB.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                                      <TableCell className="text-center">
                                        {diff !== 0 ? (
                                          <span className={diff > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                                            {diff > 0 ? '+' : ''}¥{diff.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">相同</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                {/* 报价总计 */}
                                <TableRow className="bg-muted/30 font-bold">
                                  <TableCell>报价总计</TableCell>
                                  <TableCell className="text-center font-mono text-blue-700">
                                    ¥{num(compareDataA.total).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-center font-mono text-orange-700">
                                    ¥{num(compareDataB.total).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={totalDiff > 0 ? 'text-red-600' : totalDiff < 0 ? 'text-green-600' : 'text-muted-foreground'}>
                                      {totalDiff > 0 ? '+' : ''}¥{totalDiff.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                      <span className="text-xs ml-1">({totalDiff > 0 ? '+' : ''}{totalDiffPercent}%)</span>
                                    </span>
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>

                        {/* 明细项对比 */}
                        <Card className="overflow-hidden">
                          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 via-purple-50/50 to-orange-50/80 border-b">
                            <CardTitle className="text-base flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <ClipboardList className="h-4 w-4 text-purple-600" />
                                明细项对比
                              </span>
                              <div className="flex gap-4 text-xs font-normal">
                                <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> A独有 {mergedItems.filter(i => i.onlyInA).length}项
                                </span>
                                <span className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> B独有 {mergedItems.filter(i => i.onlyInB).length}项
                                </span>
                                <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> 相同 {mergedItems.filter(i => !i.onlyInA && !i.onlyInB && i.diffAmount === 0).length}项
                                </span>
                                <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> 差异 {mergedItems.filter(i => !i.onlyInA && !i.onlyInB && i.diffAmount !== 0).length}项
                                </span>
                              </div>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            {mergedItems.length === 0 ? (
                              <div className="text-center text-muted-foreground py-12">
                                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p>暂无明细项数据</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-dashed">
                                {mergedItems.map((item, idx) => {
                                  const isSame = !item.onlyInA && !item.onlyInB && item.diffAmount === 0;
                                  const isDiff = !item.onlyInA && !item.onlyInB && item.diffAmount !== 0;
                                  const diffPercent = item.amountA > 0 ? ((item.diffAmount / item.amountA) * 100).toFixed(1) : '0.0';

                                  return (
                                    <div
                                      key={idx}
                                      className={
                                        `px-5 py-3.5 transition-colors ` +
                                        (item.onlyInA ? 'bg-blue-50/60 border-l-[3px] border-l-blue-400' :
                                         item.onlyInB ? 'bg-orange-50/60 border-l-[3px] border-l-orange-400' :
                                         isSame ? 'border-l-[3px] border-l-green-400' :
                                         'bg-red-50/30 border-l-[3px] border-l-red-400')
                                      }
                                    >
                                      {/* 项目名称行 */}
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-muted-foreground font-mono w-6">{idx + 1}.</span>
                                        <span className="font-semibold text-sm">{item.name}</span>
                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.unit}</span>
                                        {item.onlyInA && (
                                          <span className="text-[10px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full border border-blue-200">仅A</span>
                                        )}
                                        {item.onlyInB && (
                                          <span className="text-[10px] font-medium text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full border border-orange-200">仅B</span>
                                        )}
                                        {isDiff && (
                                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                                            item.diffAmount > 0 ? 'text-red-700 bg-red-100 border-red-200' : 'text-emerald-700 bg-emerald-100 border-emerald-200'
                                          }`}>
                                            {item.diffAmount > 0 ? 'B更高' : 'A更高'}
                                          </span>
                                        )}
                                        {isSame && (
                                          <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full border border-green-200">一致</span>
                                        )}
                                      </div>

                                      {/* 左右对比 */}
                                      <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center ml-6">
                                        {/* 报价单A */}
                                        <div className={`rounded-lg px-3 py-2 text-sm ${
                                          item.onlyInA ? 'bg-blue-100/80 ring-1 ring-blue-200' :
                                          item.quantityA !== null ? 'bg-blue-50/50 ring-1 ring-blue-100' : 'bg-muted/30'
                                        }`}>
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold">A</span>
                                            <span className="text-xs text-muted-foreground">
                                              {item.quantityA !== null ? `${item.quantityA} ${item.unit} × ¥${item.priceA!.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '无此项目'}
                                            </span>
                                          </div>
                                          <div className="font-mono font-semibold text-blue-800">
                                            {item.amountA > 0 ? `¥${item.amountA.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                                          </div>
                                        </div>

                                        {/* 中间差异指示 */}
                                        <div className="flex flex-col items-center gap-0.5 min-w-[80px]">
                                          {isDiff ? (
                                            <>
                                              <span className={`text-xs font-bold ${item.diffAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {item.diffAmount > 0 ? '↑' : '↓'}
                                              </span>
                                              <span className={`text-xs font-semibold ${item.diffAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {item.diffAmount > 0 ? '+' : ''}¥{item.diffAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                              </span>
                                              <span className={`text-[10px] ${item.diffAmount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                ({item.diffAmount > 0 ? '+' : ''}{diffPercent}%)
                                              </span>
                                            </>
                                          ) : isSame ? (
                                            <span className="text-green-500 text-lg">＝</span>
                                          ) : item.onlyInA ? (
                                            <span className="text-blue-400 text-xs">→ 仅A</span>
                                          ) : (
                                            <span className="text-orange-400 text-xs">仅B ←</span>
                                          )}
                                        </div>

                                        {/* 报价单B */}
                                        <div className={`rounded-lg px-3 py-2 text-sm ${
                                          item.onlyInB ? 'bg-orange-100/80 ring-1 ring-orange-200' :
                                          item.quantityB !== null ? 'bg-orange-50/50 ring-1 ring-orange-100' : 'bg-muted/30'
                                        }`}>
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-orange-500 text-white text-[9px] font-bold">B</span>
                                            <span className="text-xs text-muted-foreground">
                                              {item.quantityB !== null ? `${item.quantityB} ${item.unit} × ¥${item.priceB!.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '无此项目'}
                                            </span>
                                          </div>
                                          <div className="font-mono font-semibold text-orange-800">
                                            {item.amountB > 0 ? `¥${item.amountB.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* 明细合计行 */}
                                <div className="px-5 py-4 bg-gradient-to-r from-blue-50/40 via-purple-50/30 to-orange-50/40 border-l-[3px] border-l-purple-400">
                                  <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center ml-6">
                                    <div className="rounded-lg px-3 py-2.5 bg-blue-100/60 ring-1 ring-blue-200">
                                      <div className="text-xs text-muted-foreground mb-0.5">A 明细合计</div>
                                      <div className="font-mono font-bold text-blue-800 text-base">
                                        ¥{mergedItems.reduce((s, i) => s + i.amountA, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-center min-w-[80px]">
                                      <span className="text-xs text-muted-foreground mb-0.5">明细差异</span>
                                      {(() => {
                                        const totalItemDiff = mergedItems.reduce((s, i) => s + i.diffAmount, 0);
                                        return (
                                          <span className={`font-mono font-bold text-sm ${totalItemDiff > 0 ? 'text-red-600' : totalItemDiff < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                            {totalItemDiff > 0 ? '+' : ''}¥{totalItemDiff.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                    <div className="rounded-lg px-3 py-2.5 bg-orange-100/60 ring-1 ring-orange-200">
                                      <div className="text-xs text-muted-foreground mb-0.5">B 明细合计</div>
                                      <div className="font-mono font-bold text-orange-800 text-base">
                                        ¥{mergedItems.reduce((s, i) => s + i.amountB, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* 返回选择 */}
                        <div className="flex justify-center gap-3">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCompareDataA(null);
                              setCompareDataB(null);
                            }}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            重新选择
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCompareQuoteA(null);
                              setCompareQuoteB(null);
                              setCompareDataA(null);
                              setCompareDataB(null);
                              setCompareDialogOpen(false);
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            关闭
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="quotas" className="mt-6 space-y-6">
          {/* 搜索与筛选栏 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:max-w-[320px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索定额名称、编号、备注、品牌型号..."
                      value={quotaSearchKeyword}
                      onChange={(e) => setQuotaSearchKeyword(e.target.value)}
                      className="pl-9 pr-8"
                    />
                    {quotaSearchKeyword && (
                      <button
                        onClick={() => setQuotaSearchKeyword('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select value={quotaCategoryFilter} onValueChange={setQuotaCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="分类筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部分类</SelectItem>
                      {allQuotaCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">自施工 <strong className="text-foreground">{selfConstructionTotal}</strong>项</span>
                  <span className="text-sm text-muted-foreground">智能化 <strong className="text-foreground">{intelligentTotal}</strong>项</span>
                  <div className="h-4 w-px bg-border" />
                  <Button variant="outline" size="sm" onClick={() => openImportDialog('selfConstruction')}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    导入自施工
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openImportDialog('intelligent')}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    导入智能化
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Download className="h-3.5 w-3.5 mr-1" />
                        下载模板
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownloadTemplate('selfConstruction')}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        自施工定额导入模板
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadTemplate('intelligent')}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        智能化定额导入模板
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 自施工工序定额 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>自施工工序定额</CardTitle>
                  <CardDescription>宽带、专线项目和常规内部布线施工工序</CardDescription>
                </div>
                <Button size="sm" onClick={() => openAddQuotaDialog('selfConstruction')}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingQuotas ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  ))}
                </div>
              ) : dbSelfConstruction.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>编号</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>定额名称</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbSelfConstruction.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.id}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.category}
                          </span>
                        </TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>¥{item.price.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{item.remark || '-'}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditQuotaDialog('selfConstruction', item)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openDeleteQuotaDialog('selfConstruction', item.id, item.name)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {renderQuotaPagination(selfConstructionPage, selfConstructionTotalPages, selfConstructionTotal, handleSelfConstructionPageChange)}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">没有找到匹配的自施工定额项</p>
                <p className="text-xs mt-1">请尝试调整搜索关键词或分类筛选</p>
              </div>
            )}
          </CardContent>
        </Card>

          {/* 集成商智能化项目报价 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>集成商智能化项目报价</CardTitle>
                  <CardDescription>设备和施工安装项目报价</CardDescription>
                </div>
                <Button size="sm" onClick={() => openAddQuotaDialog('intelligent')}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingQuotas ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  ))}
                </div>
              ) : dbIntelligentProject.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>编号</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>定额名称</TableHead>
                      <TableHead>品牌型号</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>可抵扣税率</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbIntelligentProject.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.id}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {item.category}
                          </span>
                        </TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.brandModel || '-'}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>¥{item.price.toFixed(2)}</TableCell>
                        <TableCell>{item.deductibleTaxRate}%</TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">{item.remark || '-'}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditQuotaDialog('intelligent', item)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openDeleteQuotaDialog('intelligent', item.id, item.name)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {renderQuotaPagination(intelligentPage, intelligentTotalPages, intelligentTotal, handleIntelligentPageChange)}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">没有找到匹配的智能化项目定额项</p>
                <p className="text-xs mt-1">请尝试调整搜索关键词或分类筛选</p>
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        {/* 统计看板 */}
        <TabsContent value="stats" className="mt-6 space-y-6">
          {isLoadingStats ? (
            <div className="grid gap-6 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-[80px] mb-2" />
                    <Skeleton className="h-8 w-[120px] mb-1" />
                    <Skeleton className="h-3 w-[60px]" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : statsData ? (
            <>
              {/* 概览卡片 */}
              <div className="grid gap-6 md:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">报价总数</p>
                        <p className="text-3xl font-bold mt-1">{statsData.overview.totalCount}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {statsData.thisMonth.countChange >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                          )}
                          <span className={`text-xs font-medium ${statsData.thisMonth.countChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {statsData.thisMonth.countChange >= 0 ? '+' : ''}{statsData.thisMonth.countChange}%
                          </span>
                          <span className="text-xs text-muted-foreground">较上月</span>
                        </div>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">报价总额</p>
                        <p className="text-3xl font-bold mt-1">¥{(statsData.overview.totalAmount / 10000).toFixed(1)}<span className="text-lg font-normal text-muted-foreground">万</span></p>
                        <div className="flex items-center gap-1 mt-1">
                          {statsData.thisMonth.amountChange >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                          )}
                          <span className={`text-xs font-medium ${statsData.thisMonth.amountChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {statsData.thisMonth.amountChange >= 0 ? '+' : ''}{statsData.thisMonth.amountChange}%
                          </span>
                          <span className="text-xs text-muted-foreground">较上月</span>
                        </div>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">平均报价</p>
                        <p className="text-3xl font-bold mt-1">¥{(statsData.overview.avgAmount / 10000).toFixed(1)}<span className="text-lg font-normal text-muted-foreground">万</span></p>
                        <p className="text-xs text-muted-foreground mt-1">
                          最高 ¥{(statsData.overview.maxAmount / 10000).toFixed(1)}万 / 最低 ¥{(statsData.overview.minAmount / 10000).toFixed(1)}万
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">本月新增</p>
                        <p className="text-3xl font-bold mt-1">{statsData.thisMonth.count}<span className="text-lg font-normal text-muted-foreground">单</span></p>
                        <p className="text-xs text-muted-foreground mt-1">
                          本月总额 ¥{(statsData.thisMonth.totalAmount / 10000).toFixed(1)}万
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 图表区域 */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* 月度趋势图 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      月度趋势
                    </CardTitle>
                    <CardDescription>近12个月报价数量与金额趋势</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsData.byMonth.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={statsData.byMonth}>
                          <defs>
                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} tickFormatter={(v) => v.split('-')[1] + '月'} />
                          <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              if (name === 'totalAmount') return [`¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, '报价金额'];
                              return [value, '报价数量'];
                            }}
                            labelFormatter={(label) => `${label}`}
                          />
                          <Legend formatter={(value) => value === 'totalAmount' ? '报价金额' : '报价数量'} />
                          <Area yAxisId="left" type="monotone" dataKey="totalAmount" stroke="#3b82f6" fill="url(#colorAmount)" name="totalAmount" />
                          <Bar yAxisId="right" dataKey="count" fill="#93c5fd" radius={[4, 4, 0, 0]} name="count" barSize={20} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        暂无数据
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 状态分布饼图 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      状态分布
                    </CardTitle>
                    <CardDescription>各状态报价单数量占比</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsData.byStatus.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={statsData.byStatus.map(item => ({
                              name: { draft: '草稿', submitted: '已提交', approved: '已审批', rejected: '已驳回' }[item.status] || item.status,
                              value: item.count,
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={4}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            <Cell fill="#94a3b8" /> {/* draft - 灰色 */}
                            <Cell fill="#3b82f6" /> {/* submitted - 蓝色 */}
                            <Cell fill="#22c55e" /> {/* approved - 绿色 */}
                            <Cell fill="#ef4444" /> {/* rejected - 红色 */}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value}单`, '数量']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        暂无数据
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* 客户报价频次 TOP10 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      客户报价频次 TOP10
                    </CardTitle>
                    <CardDescription>报价次数最多的客户排名</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsData.byClient.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={statsData.byClient} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis type="category" dataKey="clientName" tick={{ fontSize: 12 }} width={80} />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              if (name === 'totalAmount') return [`¥${(value / 10000).toFixed(2)}万`, '报价总额'];
                              return [`${value}单`, '报价次数'];
                            }}
                          />
                          <Legend formatter={(value) => value === 'count' ? '报价次数' : '报价总额'} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="count" barSize={16} />
                          <Bar dataKey="totalAmount" fill="#93c5fd" radius={[0, 4, 4, 0]} name="totalAmount" barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        暂无数据
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 金额分布 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      报价金额分布
                    </CardTitle>
                    <CardDescription>各金额区间的报价单数量</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsData.byAmountRange.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={statsData.byAmountRange}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: number) => [`${value}单`, '数量']} />
                          <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="count" barSize={40}>
                            {statsData.byAmountRange.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'][index % 6]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        暂无数据
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 状态明细表 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5" />
                        状态明细
                      </CardTitle>
                      <CardDescription>各状态报价单数量与金额统计</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoadingStats}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingStats ? 'animate-spin' : ''}`} />
                      刷新数据
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                        <TableHead className="text-right">占比</TableHead>
                        <TableHead className="text-right">报价总额</TableHead>
                        <TableHead className="text-right">平均报价</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statsData.byStatus.map((item) => {
                        const statusLabels: Record<string, string> = {
                          draft: '草稿',
                          submitted: '已提交',
                          approved: '已审批',
                          rejected: '已驳回',
                        };
                        const percentage = statsData.overview.totalCount > 0
                          ? ((item.count / statsData.overview.totalCount) * 100).toFixed(1)
                          : '0.0';
                        const avgAmount = item.count > 0 ? item.totalAmount / item.count : 0;
                        return (
                          <TableRow key={item.status}>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell className="text-right font-medium">{item.count}单</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 bg-muted rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm">{percentage}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">¥{item.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right text-muted-foreground">¥{avgAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">暂无统计数据</p>
                  <p className="text-sm mt-1">创建报价单后即可查看统计信息</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 定额库编辑对话框 */}
      <Dialog open={quotaEditDialogOpen} onOpenChange={setQuotaEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {quotaEditMode === 'add' ? <Plus className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
              {quotaEditMode === 'add' ? '新增定额项' : '编辑定额项'}
              <Badge variant="outline" className="ml-2">
                {quotaEditType === 'selfConstruction' ? '自施工' : '智能化'}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {quotaEditMode === 'add' ? '填写定额项信息，添加到定额库中' : '修改定额项信息'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quota-id">编号 <span className="text-destructive">*</span></Label>
                <Input
                  id="quota-id"
                  value={quotaEditForm.id || ''}
                  onChange={(e) => setQuotaEditForm({ ...quotaEditForm, id: e.target.value })}
                  placeholder="如：39 或 I-38"
                  disabled={quotaEditMode === 'edit'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quota-category">分类 <span className="text-destructive">*</span></Label>
                <Select
                  value={quotaEditForm.category || ''}
                  onValueChange={(value) => setQuotaEditForm({ ...quotaEditForm, category: value })}
                >
                  <SelectTrigger id="quota-category">
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {quotaEditType === 'selfConstruction' ? (
                      <>
                        <SelectItem value="宽带、专线项目">宽带、专线项目</SelectItem>
                        <SelectItem value="常规内部布线">常规内部布线</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="设备">设备</SelectItem>
                        <SelectItem value="施工安装">施工安装</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quota-name">定额名称 <span className="text-destructive">*</span></Label>
              <Input
                id="quota-name"
                value={quotaEditForm.name || ''}
                onChange={(e) => setQuotaEditForm({ ...quotaEditForm, name: e.target.value })}
                placeholder="输入定额名称"
              />
            </div>
            {quotaEditType === 'intelligent' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quota-serialNumber">序号</Label>
                    <Input
                      id="quota-serialNumber"
                      type="number"
                      value={quotaEditForm.serialNumber || ''}
                      onChange={(e) => setQuotaEditForm({ ...quotaEditForm, serialNumber: Number(e.target.value) })}
                      placeholder="序号"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quota-brandModel">品牌型号</Label>
                    <Input
                      id="quota-brandModel"
                      value={quotaEditForm.brandModel || ''}
                      onChange={(e) => setQuotaEditForm({ ...quotaEditForm, brandModel: e.target.value })}
                      placeholder="品牌型号"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quota-description">描述</Label>
                  <Input
                    id="quota-description"
                    value={quotaEditForm.description || ''}
                    onChange={(e) => setQuotaEditForm({ ...quotaEditForm, description: e.target.value })}
                    placeholder="项目描述"
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quota-unit">单位 <span className="text-destructive">*</span></Label>
                <Input
                  id="quota-unit"
                  value={quotaEditForm.unit || ''}
                  onChange={(e) => setQuotaEditForm({ ...quotaEditForm, unit: e.target.value })}
                  placeholder="如：米、个、台"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quota-price">单价 <span className="text-destructive">*</span></Label>
                <Input
                  id="quota-price"
                  type="number"
                  step="0.01"
                  value={quotaEditForm.price || ''}
                  onChange={(e) => setQuotaEditForm({ ...quotaEditForm, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              {quotaEditType === 'selfConstruction' ? (
                <div className="space-y-2">
                  <Label htmlFor="quota-quantity">默认数量</Label>
                  <Input
                    id="quota-quantity"
                    type="number"
                    value={quotaEditForm.quantity || ''}
                    onChange={(e) => setQuotaEditForm({ ...quotaEditForm, quantity: Number(e.target.value) })}
                    placeholder="1"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="quota-taxRate">可抵扣税率(%)</Label>
                  <Input
                    id="quota-taxRate"
                    type="number"
                    step="0.01"
                    value={quotaEditForm.deductibleTaxRate || ''}
                    onChange={(e) => setQuotaEditForm({ ...quotaEditForm, deductibleTaxRate: Number(e.target.value) })}
                    placeholder="13"
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quota-remark">备注</Label>
              <Input
                id="quota-remark"
                value={quotaEditForm.remark || ''}
                onChange={(e) => setQuotaEditForm({ ...quotaEditForm, remark: e.target.value })}
                placeholder="备注信息（可选）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveQuota}>
              <Save className="h-4 w-4 mr-2" />
              {quotaEditMode === 'add' ? '新增' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 定额库删除确认对话框 */}
      <Dialog open={quotaDeleteDialogOpen} onOpenChange={setQuotaDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              确定要删除定额项「{quotaDeleteTarget?.name}」（编号：{quotaDeleteTarget?.id}）吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setQuotaDeleteDialogOpen(false); setQuotaDeleteTarget(null); }}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteQuota}>
              <Trash2 className="h-4 w-4 mr-2" />
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 定额库导入对话框 */}
      <Dialog open={quotaImportDialogOpen} onOpenChange={setQuotaImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              批量导入定额数据
              <Badge variant="outline" className="ml-2">
                {quotaImportType === 'selfConstruction' ? '自施工' : '智能化'}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              从Excel文件批量导入定额数据，支持 .xlsx、.xls、.csv 格式。ID已存在的数据将自动更新。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 文件选择区域 */}
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              onClick={() => quotaFileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">点击选择文件或拖拽文件到此处</p>
              <p className="text-xs text-muted-foreground mt-1">支持 .xlsx、.xls、.csv 格式</p>
              {quotaImportFileName && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{quotaImportFileName}</span>
                  <Badge variant="secondary">{quotaImportData.length} 条数据</Badge>
                </div>
              )}
            </div>
            <input
              ref={quotaFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleQuotaFileSelect}
            />

            {/* 表头格式提示 */}
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs font-medium mb-1">Excel表头格式要求：</p>
              {quotaImportType === 'selfConstruction' ? (
                <p className="text-xs text-muted-foreground">编号、分类、名称、单位、数量、单价、备注</p>
              ) : (
                <p className="text-xs text-muted-foreground">编号、序号、分类、名称、品牌型号、描述、可抵扣税率、单位、单价、备注</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                也可下载导入模板填写后上传，支持中英文表头
              </p>
            </div>

            {/* 解析错误提示 */}
            {quotaImportErrors.length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs font-medium text-destructive mb-1">
                  发现 {quotaImportErrors.length} 个问题：
                </p>
                <div className="max-h-[120px] overflow-y-auto">
                  {quotaImportErrors.map((err, idx) => (
                    <p key={idx} className="text-xs text-destructive/80">{err}</p>
                  ))}
                </div>
              </div>
            )}

            {/* 数据预览 */}
            {quotaImportData.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-medium">数据预览（前5条）</span>
                  <Badge variant="secondary">{quotaImportData.length} 条</Badge>
                </div>
                <div className="max-h-[200px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-8">编号</TableHead>
                        <TableHead className="text-xs h-8">分类</TableHead>
                        <TableHead className="text-xs h-8">名称</TableHead>
                        <TableHead className="text-xs h-8">单位</TableHead>
                        <TableHead className="text-xs h-8">单价</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotaImportData.slice(0, 5).map((record, idx) => {
                        const id = record['编号'] || record['id'] || record['ID'] || '';
                        const category = record['分类'] || record['category'] || '';
                        const name = record['名称'] || record['定额名称'] || record['name'] || '';
                        const unit = record['单位'] || record['unit'] || '';
                        const price = record['单价'] || record['price'] || '';
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-xs py-1.5 font-mono">{id}</TableCell>
                            <TableCell className="text-xs py-1.5">{category}</TableCell>
                            <TableCell className="text-xs py-1.5">{name}</TableCell>
                            <TableCell className="text-xs py-1.5">{unit}</TableCell>
                            <TableCell className="text-xs py-1.5">{price}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {quotaImportData.length > 5 && (
                  <div className="bg-muted/30 px-3 py-1.5 text-center">
                    <span className="text-xs text-muted-foreground">还有 {quotaImportData.length - 5} 条数据未显示</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaImportDialogOpen(false)} disabled={isImporting}>取消</Button>
            <Button
              onClick={handleQuotaImport}
              disabled={quotaImportData.length === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  确认导入 ({quotaImportData.length} 条)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 预览对话框 */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl w-[calc(100%-2rem)] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                报价单预览
              </DialogTitle>
              <DialogDescription className="mt-1">{previewTitle}</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDFFromPreview} disabled={isExportingPDF}>
                {isExportingPDF ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                {isExportingPDF ? '导出中...' : '导出PDF'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportFromPreview}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                导出Word
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <FileDown className="h-4 w-4 mr-2" />
                打印
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full border rounded-lg bg-white"
              title="报价单预览"
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 创建分享链接对话框 */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              生成分享链接
            </DialogTitle>
            <DialogDescription>
              为报价单「{shareTarget?.quote_number} - {shareTarget?.project_name}」创建临时分享链接，客户无需登录即可在线查看
            </DialogDescription>
          </DialogHeader>

          {!shareResult ? (
            <div className="space-y-4 py-2">
              {/* 报价单信息 */}
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">报价单号：</span>
                    <span className="font-mono">{shareTarget?.quote_number}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">项目名称：</span>
                    <span>{shareTarget?.project_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">客户名称：</span>
                    <span>{shareTarget?.client_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">报价总额：</span>
                    <span className="font-semibold">¥{shareTarget ? Number(shareTarget.total).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'}</span>
                  </div>
                </div>
              </div>

              {/* 分享设置 */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="share-password" className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    访问密码（可选，留空则无需密码）
                  </Label>
                  <Input
                    id="share-password"
                    type="text"
                    placeholder="设置访问密码，留空则无需密码"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    maxLength={20}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="share-expires" className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    有效期（天）
                  </Label>
                  <Select value={String(shareExpiresDays)} onValueChange={(val) => setShareExpiresDays(Number(val))}>
                    <SelectTrigger id="share-expires">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1天</SelectItem>
                      <SelectItem value="3">3天</SelectItem>
                      <SelectItem value="7">7天（推荐）</SelectItem>
                      <SelectItem value="15">15天</SelectItem>
                      <SelectItem value="30">30天</SelectItem>
                      <SelectItem value="0">永久有效</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="share-max-views">最大查看次数（0为不限制）</Label>
                  <Input
                    id="share-max-views"
                    type="number"
                    min={0}
                    placeholder="0 = 不限制"
                    value={shareMaxViews}
                    onChange={(e) => setShareMaxViews(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="share-remark">备注（可选）</Label>
                  <Input
                    id="share-remark"
                    placeholder="例如：发送给张总审批"
                    value={shareRemark}
                    onChange={(e) => setShareRemark(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* 创建成功 - 显示链接 */
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center justify-center py-4">
                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <Check className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-base font-semibold">分享链接已创建</p>
                <p className="text-sm text-muted-foreground mt-1">复制以下链接发送给客户即可查看报价单</p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">分享链接</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-background px-3 py-2 rounded border break-all select-all">
                    {shareResult.shareUrl}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleCopyShareUrl} className="shrink-0">
                    {shareCopied ? (
                      <><Check className="h-4 w-4 mr-1 text-green-600" /> 已复制</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> 复制</>
                    )}
                  </Button>
                </div>
              </div>

              {sharePassword && (
                <div className="rounded-lg border bg-blue-50/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-blue-700">访问密码</p>
                  <p className="text-lg font-mono font-bold tracking-widest text-blue-800">{sharePassword}</p>
                  <p className="text-xs text-muted-foreground">请将密码一并发送给客户</p>
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p>• 客户打开链接后可直接查看报价单，无需登录</p>
                {shareExpiresDays > 0 && <p>• 链接将在 {shareExpiresDays} 天后过期</p>}
                {shareExpiresDays === 0 && <p>• 链接永久有效，建议手动停用</p>}
                {shareMaxViews > 0 && <p>• 最多可查看 {shareMaxViews} 次</p>}
              </div>
            </div>
          )}

          <DialogFooter>
            {!shareResult ? (
              <>
                <Button variant="outline" onClick={() => setShareDialogOpen(false)}>取消</Button>
                <Button onClick={handleCreateShare} disabled={isCreatingShare}>
                  {isCreatingShare ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />创建中...</>
                  ) : (
                    <><Link2 className="h-4 w-4 mr-2" />创建分享链接</>
                  )}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShareDialogOpen(false)}>关闭</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分享记录管理对话框 */}
      <Dialog open={shareListDialogOpen} onOpenChange={setShareListDialogOpen}>
        <DialogContent className="max-w-4xl w-[calc(100%-2rem)] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              分享记录
            </DialogTitle>
            <DialogDescription>
              报价单「{shareTarget?.quote_number} - {shareTarget?.project_name}」的所有分享链接
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto -mx-6 px-6">
            {isLoadingShareList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : shareList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Share2 className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">暂无分享记录</p>
                <p className="text-xs mt-1">点击「生成分享链接」创建第一个分享</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">状态</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">密码</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">有效期</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">查看次数</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">备注</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">创建时间</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shareList.map((share: any) => {
                      const isExpired = share.isExpired;
                      const isActive = share.isActive && !isExpired;
                      return (
                        <TableRow key={share.id}>
                          <TableCell>
                            {isActive ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">有效</Badge>
                            ) : isExpired ? (
                              <Badge variant="outline" className="text-yellow-700 border-yellow-300 text-xs">已过期</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">已停用</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {share.hasPassword ? (
                              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-blue-600" />{share.password}</span>
                            ) : (
                              <span className="text-muted-foreground">无</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {share.expiresAt ? (
                              <span className={isExpired ? 'text-yellow-600' : ''}>
                                {new Date(share.expiresAt).toLocaleDateString('zh-CN')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">永久</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {share.maxViews > 0 ? (
                              <span>{share.viewCount}/{share.maxViews}</span>
                            ) : (
                              <span>{share.viewCount}次</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                            {share.remark || '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(share.createdAt).toLocaleString('zh-CN')}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {isActive && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-destructive hover:text-destructive"
                                  onClick={() => handleDeactivateShare(share.id)}
                                >
                                  停用
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={async () => {
                                  const url = `${window.location.origin}${share.shareUrl}`;
                                  try {
                                    await navigator.clipboard.writeText(url);
                                    toast.success('链接已复制');
                                  } catch {
                                    const textarea = document.createElement('textarea');
                                    textarea.value = url;
                                    document.body.appendChild(textarea);
                                    textarea.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(textarea);
                                    toast.success('链接已复制');
                                  }
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                复制
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setShareListDialogOpen(false)}>关闭</Button>
            {shareTarget && (
              <Button
                onClick={() => {
                  setShareListDialogOpen(false);
                  setTimeout(() => handleOpenShareDialog(shareTarget), 200);
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                新建分享
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
