'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Bot, MessageSquare, Settings, Brain, Key, TestTube, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// 智能体接口
interface Agent {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  temperature: number;
  enabled: number;
  created_at: string;
}

// AI模型配置接口
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
  created_at?: string;
}

// 智能体技能接口
interface AgentSkill {
  id: number;
  agent_id: number;
  skill_name: string;
  skill_type: string;
  config_json: string;
  enabled: number;
  priority: number;
}

// 可用技能列表
const AVAILABLE_SKILLS = [
  { value: 'device_recognition', label: '设备清单识别', type: 'recognition' },
  { value: 'quote_calculation', label: '报价计算', type: 'calculation' },
  { value: 'quota_query', label: '定额查询', type: 'query' },
  { value: 'formula_explanation', label: '公式解释', type: 'explanation' },
  { value: 'report_generation', label: '报告生成', type: 'generation' },
  { value: 'problem_diagnosis', label: '问题诊断', type: 'diagnosis' },
];

// 提供商预设配置
const PROVIDER_PRESETS: Record<string, { endpoint: string; models: string[] }> = {
  doubao: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-lite-260215', 'doubao-seed-2-0-mini-260215', 'doubao-seed-1-8-251228'],
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-v3-2-251201', 'deepseek-reasoner'],
  },
  openai: {
    endpoint: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  qwen: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  },
  moonshot: {
    endpoint: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'kimi-k2-5-260127'],
  },
  zhipu: {
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-4-flash', 'glm-5-0-260211'],
  },
  minimax: {
    endpoint: 'https://api.minimax.chat/v1',
    models: ['MiniMax-M1', 'abab6.5s-chat', 'abab6.5-chat', 'abab6-chat'],
  },
};

export default function AIConfigPage() {
  const { toast } = useToast();
  
  // 标签页状态
  const [activeTab, setActiveTab] = useState('agents');
  
  // 智能体状态
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Partial<Agent>>({});
  const [editingSkill, setEditingSkill] = useState<Partial<AgentSkill>>({});
  
  // AI模型状态
  const [models, setModels] = useState<AIModelConfig[]>([]);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Partial<AIModelConfig>>({});
  const [selectedProvider, setSelectedProvider] = useState<string>('doubao');
  const [testingModel, setTestingModel] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadAgents();
    loadModels();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      loadSkills(selectedAgent.id);
    }
  }, [selectedAgent]);

  // 加载智能体列表
  const loadAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (error) {
      console.error('加载智能体列表失败:', error);
    }
  };

  // 加载AI模型列表
  const loadModels = async () => {
    try {
      const res = await fetch('/api/ai-models');
      if (res.ok) {
        const data = await res.json();
        // API返回的是 {success, data, presets} 格式
        setModels(data.data || []);
      }
    } catch (error) {
      console.error('加载AI模型列表失败:', error);
    }
  };

  // 加载技能列表
  const loadSkills = async (agentId: number) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/skills`);
      if (res.ok) {
        const data = await res.json();
        setSkills(data);
      }
    } catch (error) {
      console.error('加载技能列表失败:', error);
    }
  };

  // 创建/更新智能体
  const handleSaveAgent = async () => {
    try {
      const method = editingAgent.id ? 'PUT' : 'POST';
      const url = editingAgent.id ? `/api/agents/${editingAgent.id}` : '/api/agents';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAgent),
      });
      
      if (res.ok) {
        toast({ title: '成功', description: `智能体已${editingAgent.id ? '更新' : '创建'}` });
        setIsAgentDialogOpen(false);
        setEditingAgent({});
        loadAgents();
      }
    } catch (error) {
      toast({ title: '错误', description: '操作失败', variant: 'destructive' });
    }
  };

  // 删除智能体
  const handleDeleteAgent = async (id: number) => {
    if (!confirm('确定要删除这个智能体吗？')) return;
    
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: '成功', description: '智能体已删除' });
        loadAgents();
        if (selectedAgent?.id === id) {
          setSelectedAgent(null);
        }
      }
    } catch (error) {
      toast({ title: '错误', description: '删除失败', variant: 'destructive' });
    }
  };

  // 创建/更新AI模型
  const handleSaveModel = async () => {
    try {
      const method = editingModel.id ? 'PUT' : 'POST';
      const url = editingModel.id ? `/api/ai-models/${editingModel.id}` : '/api/ai-models';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingModel),
      });
      
      if (res.ok) {
        toast({ title: '成功', description: `AI模型已${editingModel.id ? '更新' : '创建'}` });
        setIsModelDialogOpen(false);
        setEditingModel({});
        loadModels();
      }
    } catch (error) {
      toast({ title: '错误', description: '操作失败', variant: 'destructive' });
    }
  };

  // 删除AI模型
  const handleDeleteModel = async (id: number) => {
    if (!confirm('确定要删除这个AI模型吗？')) return;
    
    try {
      const res = await fetch(`/api/ai-models/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: '成功', description: 'AI模型已删除' });
        loadModels();
      }
    } catch (error) {
      toast({ title: '错误', description: '删除失败', variant: 'destructive' });
    }
  };

  // 测试AI模型
  const handleTestModel = async (model: AIModelConfig) => {
    setTestingModel(model.id);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/ai-models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: model.id,
          message: '你好，请简单介绍一下自己',
        }),
      });
      
      const data = await res.json();
      setTestResult({ success: res.ok, message: data.message || data.error || '测试完成' });
    } catch (error) {
      setTestResult({ success: false, message: '测试请求失败' });
    } finally {
      setTestingModel(null);
    }
  };

  // 设置默认模型
  const handleSetDefault = async (id: number) => {
    try {
      const res = await fetch(`/api/ai-models/${id}/default`, { method: 'POST' });
      if (res.ok) {
        toast({ title: '成功', description: '已设为默认模型' });
        loadModels();
      }
    } catch (error) {
      toast({ title: '错误', description: '设置失败', variant: 'destructive' });
    }
  };

  // 提供商选择变化
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const preset = PROVIDER_PRESETS[provider];
    if (preset) {
      setEditingModel({
        ...editingModel,
        provider,
        api_endpoint: preset.endpoint,
        model_name: preset.models[0] || '',
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI 配置中心</h1>
        <p className="text-muted-foreground">统一管理智能体和AI模型配置</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agents">
            <Bot className="h-4 w-4 mr-2" />
            智能体管理
          </TabsTrigger>
          <TabsTrigger value="models">
            <Brain className="h-4 w-4 mr-2" />
            AI模型配置
          </TabsTrigger>
        </TabsList>

        {/* 智能体管理标签页 */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">智能体列表</h2>
              <p className="text-sm text-muted-foreground">创建和管理AI智能体</p>
            </div>
            <Button onClick={() => { setEditingAgent({ enabled: 1, temperature: 0.7 }); setIsAgentDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              新建智能体
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 智能体列表 */}
            <div className="md:col-span-1 space-y-2">
              {agents.map(agent => (
                <Card 
                  key={agent.id} 
                  className={`cursor-pointer transition-colors ${selectedAgent?.id === agent.id ? 'border-primary' : ''}`}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        {agent.name}
                      </CardTitle>
                      <Badge variant={agent.enabled ? 'default' : 'secondary'}>
                        {agent.enabled ? '启用' : '禁用'}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">{agent.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
              {agents.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    暂无智能体，点击"新建智能体"创建
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 智能体详情 */}
            <div className="md:col-span-2">
              {selectedAgent ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{selectedAgent.name}</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingAgent(selectedAgent); setIsAgentDialogOpen(true); }}>
                          <Edit className="h-4 w-4 mr-1" />
                          编辑
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteAgent(selectedAgent.id)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          删除
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{selectedAgent.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>使用模型</Label>
                      <div className="mt-1 p-2 bg-muted rounded">{selectedAgent.model}</div>
                    </div>
                    <div>
                      <Label>温度参数</Label>
                      <div className="mt-1 p-2 bg-muted rounded">{selectedAgent.temperature}</div>
                    </div>
                    <div>
                      <Label>系统提示词</Label>
                      <div className="mt-1 p-2 bg-muted rounded max-h-32 overflow-y-auto whitespace-pre-wrap text-sm">
                        {selectedAgent.system_prompt || '未设置'}
                      </div>
                    </div>
                    
                    {/* 技能配置 */}
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <Label>技能配置</Label>
                        <Button size="sm" onClick={() => { setEditingSkill({ agent_id: selectedAgent.id, enabled: 1, priority: 0 }); setIsSkillDialogOpen(true); }}>
                          <Plus className="h-4 w-4 mr-1" />
                          添加技能
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {skills.map(skill => (
                          <div key={skill.id} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <span className="font-medium">{AVAILABLE_SKILLS.find(s => s.value === skill.skill_name)?.label || skill.skill_name}</span>
                              <Badge variant="outline" className="ml-2">{skill.skill_type}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={skill.enabled ? 'default' : 'secondary'}>
                                {skill.enabled ? '启用' : '禁用'}
                              </Badge>
                              <Button variant="ghost" size="sm" onClick={() => {
                                setEditingSkill(skill);
                                setIsSkillDialogOpen(true);
                              }}>
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {skills.length === 0 && (
                          <p className="text-sm text-muted-foreground">暂无技能</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>选择一个智能体查看详情</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* AI模型配置标签页 */}
        <TabsContent value="models" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">AI模型列表</h2>
              <p className="text-sm text-muted-foreground">配置和管理AI模型接入</p>
            </div>
            <Button onClick={() => { setEditingModel({ provider: 'doubao', temperature: 0.7, max_tokens: 4096, is_active: 1 }); setSelectedProvider('doubao'); setIsModelDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              添加模型
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map(model => (
              <Card key={model.id} className="relative">
                {model.is_default ? (
                  <Badge className="absolute top-2 right-2 bg-yellow-500">默认</Badge>
                ) : null}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    {model.name}
                  </CardTitle>
                  <CardDescription>{model.provider}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">模型：</span>
                    <span className="font-mono">{model.model_name}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">API Key：</span>
                    <span className="font-mono text-xs">{model.api_key_masked || '未设置'}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleTestModel(model)}
                      disabled={testingModel === model.id}
                    >
                      {testingModel === model.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4 mr-1" />
                      )}
                      测试
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setEditingModel(model); setSelectedProvider(model.provider); setIsModelDialogOpen(true); }}>
                      <Edit className="h-4 w-4 mr-1" />
                      编辑
                    </Button>
                    {!model.is_default && (
                      <Button variant="outline" size="sm" onClick={() => handleSetDefault(model.id)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        默认
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteModel(model.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {testingModel === model.id && testResult && (
                    <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {testResult.message}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {models.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  暂无AI模型，点击"添加模型"配置
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* 智能体编辑对话框 */}
      <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAgent.id ? '编辑智能体' : '新建智能体'}</DialogTitle>
            <DialogDescription>配置智能体的基本信息和参数</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input 
                value={editingAgent.name || ''} 
                onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                placeholder="输入智能体名称"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea 
                value={editingAgent.description || ''} 
                onChange={e => setEditingAgent({ ...editingAgent, description: e.target.value })}
                placeholder="输入智能体描述"
              />
            </div>
            <div>
              <Label>使用模型</Label>
              <Select 
                value={editingAgent.model || ''} 
                onValueChange={value => setEditingAgent({ ...editingAgent, model: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {models.filter(m => m.is_active).map(model => (
                    <SelectItem key={model.id} value={model.model_name}>
                      {model.name} ({model.model_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>温度参数 (0-1)</Label>
              <Input 
                type="number" 
                min="0" 
                max="1" 
                step="0.1"
                value={editingAgent.temperature || 0.7} 
                onChange={e => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <Label>系统提示词</Label>
              <Textarea 
                value={editingAgent.system_prompt || ''} 
                onChange={e => setEditingAgent({ ...editingAgent, system_prompt: e.target.value })}
                placeholder="输入系统提示词，定义智能体的行为和角色"
                className="min-h-32"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="enabled" 
                checked={editingAgent.enabled === 1}
                onCheckedChange={checked => setEditingAgent({ ...editingAgent, enabled: checked ? 1 : 0 })}
              />
              <Label htmlFor="enabled">启用智能体</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAgentDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveAgent}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 技能编辑对话框 */}
      <Dialog open={isSkillDialogOpen} onOpenChange={setIsSkillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSkill.id ? '编辑技能' : '添加技能'}</DialogTitle>
            <DialogDescription>配置智能体的技能</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>技能</Label>
              <Select 
                value={editingSkill.skill_name || ''} 
                onValueChange={value => {
                  const skillInfo = AVAILABLE_SKILLS.find(s => s.value === value);
                  setEditingSkill({ 
                    ...editingSkill, 
                    skill_name: value,
                    skill_type: skillInfo?.type || 'general'
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择技能" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_SKILLS.map(skill => (
                    <SelectItem key={skill.value} value={skill.value}>
                      {skill.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="skillEnabled" 
                checked={editingSkill.enabled === 1}
                onCheckedChange={checked => setEditingSkill({ ...editingSkill, enabled: checked ? 1 : 0 })}
              />
              <Label htmlFor="skillEnabled">启用技能</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSkillDialogOpen(false)}>取消</Button>
            <Button onClick={async () => {
              try {
                const method = editingSkill.id ? 'PUT' : 'POST';
                const url = `/api/agents/${editingSkill.agent_id}/skills`;
                
                const body = editingSkill.id 
                  ? { ...editingSkill, skill_id: editingSkill.id }
                  : editingSkill;
                
                const res = await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });
                
                if (res.ok) {
                  toast({ title: '成功', description: '技能已保存' });
                  setIsSkillDialogOpen(false);
                  if (selectedAgent) loadSkills(selectedAgent.id);
                }
              } catch (error) {
                toast({ title: '错误', description: '保存失败', variant: 'destructive' });
              }
            }}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI模型编辑对话框 */}
      <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingModel.id ? '编辑AI模型' : '添加AI模型'}</DialogTitle>
            <DialogDescription>配置AI模型的接入参数</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>提供商</Label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doubao">豆包 (字节跳动)</SelectItem>
                  <SelectItem value="deepseek">DeepSeek (深度求索)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="qwen">通义千问 (阿里)</SelectItem>
                  <SelectItem value="moonshot">Kimi (月之暗面)</SelectItem>
                  <SelectItem value="zhipu">智谱AI</SelectItem>
                  <SelectItem value="minimax">MiniMax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>配置名称</Label>
              <Input 
                value={editingModel.name || ''} 
                onChange={e => setEditingModel({ ...editingModel, name: e.target.value })}
                placeholder="例如：豆包主力模型"
              />
            </div>
            <div>
              <Label>API端点</Label>
              <Input 
                value={editingModel.api_endpoint || ''} 
                onChange={e => setEditingModel({ ...editingModel, api_endpoint: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>模型名称</Label>
              <Select 
                value={editingModel.model_name || ''} 
                onValueChange={value => setEditingModel({ ...editingModel, model_name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {(PROVIDER_PRESETS[selectedProvider]?.models || []).map(model => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>API Key</Label>
              <Input 
                type="password"
                value={editingModel.api_key || ''} 
                onChange={e => setEditingModel({ ...editingModel, api_key: e.target.value })}
                placeholder="输入API Key"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>温度 (0-2)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max="2" 
                  step="0.1"
                  value={editingModel.temperature || 0.7} 
                  onChange={e => setEditingModel({ ...editingModel, temperature: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>最大Token数</Label>
                <Input 
                  type="number" 
                  min="1"
                  value={editingModel.max_tokens || 4096} 
                  onChange={e => setEditingModel({ ...editingModel, max_tokens: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>描述</Label>
              <Textarea 
                value={editingModel.description || ''} 
                onChange={e => setEditingModel({ ...editingModel, description: e.target.value })}
                placeholder="输入模型描述"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="modelActive" 
                checked={editingModel.is_active === 1}
                onCheckedChange={checked => setEditingModel({ ...editingModel, is_active: checked ? 1 : 0 })}
              />
              <Label htmlFor="modelActive">启用模型</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModelDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveModel}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
