'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Brain,
  Plus,
  Edit,
  Trash2,
  Check,
  Zap,
  Settings,
  TestTube,
  Loader2,
  CheckCircle2,
  XCircle,
  Key,
  Star,
  StarOff,
  Activity,
  Database,
  Cpu,
} from 'lucide-react';

interface AIModelConfig {
  id: number;
  name: string;
  provider: string;
  model_name: string;
  api_endpoint: string;
  api_key?: string;
  api_key_masked?: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
  description?: string;
  is_active: number;
  is_default: number;
  sort_order: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

interface ProviderPreset {
  endpoint: string;
  defaultModel: string;
  models: string[];
}

const PRESET_COLORS: Record<string, string> = {
  deepseek: 'bg-blue-100 text-blue-800 border-blue-300',
  openai: 'bg-green-100 text-green-800 border-green-300',
  doubao: 'bg-purple-100 text-purple-800 border-purple-300',
  qwen: 'bg-orange-100 text-orange-800 border-orange-300',
  moonshot: 'bg-pink-100 text-pink-800 border-pink-300',
  zhipu: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  baichuan: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  custom: 'bg-gray-100 text-gray-800 border-gray-300',
};

const PROVIDER_LABELS: Record<string, string> = {
  deepseek: 'DeepSeek 深度求索',
  openai: 'OpenAI',
  doubao: '豆包 字节跳动',
  qwen: '通义千问 阿里',
  moonshot: 'Kimi 月之暗面',
  zhipu: '智谱AI',
  baichuan: '百川智能',
  custom: '自定义',
};

export default function AIModelsPage() {
  const [configs, setConfigs] = useState<AIModelConfig[]>([]);
  const [presets, setPresets] = useState<Record<string, ProviderPreset>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AIModelConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; duration?: number; reply?: string } | null>(null);
  const [activeInfo, setActiveInfo] = useState<AIModelConfig | null>(null);

  // 表单数据
  const [formData, setFormData] = useState<Partial<AIModelConfig>>({});

  // 加载配置列表
  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-models');
      const json = await res.json();
      if (json.success) {
        setConfigs(json.data || []);
        setPresets(json.presets || {});
      } else {
        alert('加载失败: ' + json.error);
      }
    } catch (e) {
      alert('加载失败: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 加载当前激活的配置
  const loadActive = async () => {
    try {
      const res = await fetch('/api/ai-models/active');
      const json = await res.json();
      if (json.success) {
        setActiveInfo(json.data);
      }
    } catch (e) {
      // 忽略
    }
  };

  useEffect(() => {
    loadConfigs();
    loadActive();
  }, []);

  // 处理创建
  const handleCreate = () => {
    setFormData({
      name: '',
      provider: 'deepseek',
      model_name: 'deepseek-v4-pro',
      api_endpoint: 'https://api.deepseek.com/v1/chat/completions',
      api_key: '',
      temperature: 0.3,
      max_tokens: 3000,
      system_prompt: '',
      description: '',
      is_default: 0,
      sort_order: 0,
    });
    setCreating(true);
  };

  // 处理编辑
  const handleEdit = (config: AIModelConfig) => {
    setFormData({ ...config, api_key: '' }); // 不显示已保存的key
    setEditing(config);
  };

  // 处理保存
  const handleSave = async () => {
    const url = editing ? `/api/ai-models?id=${editing.id}` : '/api/ai-models';
    const method = editing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          temperature: Number(formData.temperature) || 0.3,
          max_tokens: Number(formData.max_tokens) || 3000,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(editing ? '配置已更新' : '配置已创建');
        setEditing(null);
        setCreating(false);
        loadConfigs();
      } else {
        alert('保存失败: ' + json.error);
      }
    } catch (e) {
      alert('保存失败: ' + (e as Error).message);
    }
  };

  // 处理删除
  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该配置？')) return;
    try {
      const res = await fetch(`/api/ai-models?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alert('已删除');
        loadConfigs();
      } else {
        alert('删除失败: ' + json.error);
      }
    } catch (e) {
      alert('删除失败: ' + (e as Error).message);
    }
  };

  // 激活配置
  const handleActivate = async (id: number) => {
    try {
      const res = await fetch(`/api/ai-models/active?id=${id}`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert('已激活：该模型配置已设为当前使用');
        loadConfigs();
        loadActive();
      } else {
        alert('激活失败: ' + json.error);
      }
    } catch (e) {
      alert('激活失败: ' + (e as Error).message);
    }
  };

  // 测试连接
  const handleTest = async (config: AIModelConfig) => {
    setTesting(config.id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/ai-models/test?id=${config.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '请用一句话介绍你自己' }),
      });
      const json = await res.json();
      if (json.success) {
        setTestResult({
          success: true,
          message: `连接成功！耗时 ${json.data.duration}ms`,
          duration: json.data.duration,
          reply: json.data.reply,
        });
        alert(`测试成功：响应耗时 ${json.data.duration}ms`);
      } else {
        setTestResult({
          success: false,
          message: json.error || '测试失败',
        });
        alert('测试失败: ' + json.error);
      }
      loadConfigs();
    } catch (e) {
      setTestResult({ success: false, message: (e as Error).message });
      alert('测试失败: ' + (e as Error).message);
    } finally {
      setTesting(null);
    }
  };

  // 选择提供商时自动填充默认配置
  const handleProviderChange = (provider: string) => {
    const preset = presets[provider];
    if (preset) {
      setFormData({
        ...formData,
        provider,
        api_endpoint: preset.endpoint,
        model_name: preset.defaultModel,
      });
    } else {
      setFormData({ ...formData, provider });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-blue-600" />
            AI 模型配置
          </h1>
          <p className="text-gray-500 mt-1">自定义AI模型，支持多家厂商，灵活切换</p>
        </div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          新增模型配置
        </Button>
      </div>

      {/* 当前激活信息 */}
      {activeInfo && (
        <Alert className="border-blue-200 bg-blue-50">
          <Zap className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong>当前激活配置：</strong>
            {activeInfo.name} · {PROVIDER_LABELS[activeInfo.provider] || activeInfo.provider} · {activeInfo.model_name}
            <Badge className="ml-2 bg-blue-600">运行中</Badge>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">
            <Database className="h-4 w-4 mr-2" />
            配置列表
          </TabsTrigger>
          <TabsTrigger value="presets">
            <Cpu className="h-4 w-4 mr-2" />
            支持的模型
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          ) : configs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500">暂无AI模型配置</p>
                <Button onClick={handleCreate} className="mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  创建第一个配置
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {configs.map((config) => (
                <Card
                  key={config.id}
                  className={`relative ${config.is_active ? 'border-blue-500 border-2 shadow-md' : ''}`}
                >
                  {config.is_active === 1 && (
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      当前使用
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {config.name}
                          {config.is_default === 1 && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {config.description || '暂无描述'}
                        </CardDescription>
                      </div>
                      <Badge className={PRESET_COLORS[config.provider] || PRESET_COLORS.custom}>
                        {PROVIDER_LABELS[config.provider] || config.provider}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">模型：</span>
                        <span className="font-mono">{config.model_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">温度：</span>
                        <span className="font-mono">{config.temperature}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">API Key：</span>
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {config.api_key_masked || '***'}
                        </code>
                      </div>
                      <div className="col-span-2 text-xs text-gray-500 truncate">
                        <span>端点：</span>
                        {config.api_endpoint}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {config.is_active !== 1 && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleActivate(config.id)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          激活
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(config)}
                        disabled={testing === config.id}
                      >
                        {testing === config.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <TestTube className="h-3 w-3 mr-1" />
                        )}
                        测试
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(config)}>
                        <Edit className="h-3 w-3 mr-1" />
                        编辑
                      </Button>
                      {config.is_active !== 1 && config.is_default !== 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(config.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          删除
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 测试结果展示 */}
          {testResult && (
            <Alert
              className={
                testResult.success
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription>
                <strong>{testResult.success ? '测试成功' : '测试失败'}</strong>
                {testResult.message}
                {testResult.reply && (
                  <div className="mt-2 p-2 bg-white rounded text-sm">
                    <strong>AI回复：</strong>
                    {testResult.reply}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="presets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>支持的AI模型提供商</CardTitle>
              <CardDescription>系统已预设以下提供商的API端点和常用模型，您可以直接选用</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(presets).map(([key, preset]) => (
                  <Card key={key} className="border">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge className={PRESET_COLORS[key] || PRESET_COLORS.custom}>
                          {PROVIDER_LABELS[key] || key}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs font-mono break-all">
                        {preset.endpoint}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        <strong>可用模型：</strong>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {preset.models.map((m) => (
                            <Badge key={m} variant="secondary" className="font-mono text-xs">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 创建/编辑对话框 */}
      <Dialog
        open={creating || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑AI模型配置' : '新增AI模型配置'}</DialogTitle>
            <DialogDescription>
              填写AI模型连接信息，保存后可一键激活使用
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">配置名称 *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：生产环境DeepSeek"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">提供商 *</Label>
                <Select
                  value={formData.provider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(presets).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PROVIDER_LABELS[p] || p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model_name">模型名称 *</Label>
                {formData.provider && presets[formData.provider] && presets[formData.provider].models.length > 0 ? (
                  <Select
                    value={formData.model_name}
                    onValueChange={(v) => setFormData({ ...formData, model_name: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {presets[formData.provider].models.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="model_name"
                    value={formData.model_name || ''}
                    onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                    placeholder="如：deepseek-v4-pro"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature">温度 (0-2)</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.temperature || 0.3}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_endpoint">API 端点 *</Label>
              <Input
                id="api_endpoint"
                value={formData.api_endpoint || ''}
                onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                placeholder="https://api.deepseek.com/v1/chat/completions"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_key">
                API Key {editing && <span className="text-xs text-gray-500">(留空表示不修改)</span>}
              </Label>
              <div className="relative">
                <Input
                  id="api_key"
                  type="password"
                  value={formData.api_key || ''}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder={editing ? '••••••••' : 'sk-xxxxxxxxxxxxx'}
                />
                <Key className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_tokens">最大 Tokens</Label>
              <Input
                id="max_tokens"
                type="number"
                value={formData.max_tokens || 3000}
                onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="简单描述该配置的用途"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_prompt">自定义系统提示词（可选）</Label>
              <Textarea
                id="system_prompt"
                value={formData.system_prompt || ''}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                placeholder="留空则使用默认提示词"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_default"
                checked={formData.is_default === 1}
                onCheckedChange={(c) => setFormData({ ...formData, is_default: c ? 1 : 0 })}
              />
              <Label htmlFor="is_default" className="flex items-center gap-1">
                {formData.is_default === 1 ? (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
                设为默认配置
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              取消
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
