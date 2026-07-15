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
import { Plus, Edit, Trash2, Bot, MessageSquare, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface AgentSkill {
  id: number;
  agent_id: number;
  skill_name: string;
  skill_type: string;
  config_json: string;
  enabled: number;
  priority: number;
}

interface AgentLog {
  id: number;
  session_id: string;
  user_message: string;
  agent_response: string;
  created_at: string;
  user_name: string;
}

const AVAILABLE_MODELS = [
  { value: 'doubao-seed-2-0-pro-260215', label: '豆包 Seed 2.0 Pro' },
  { value: 'doubao-seed-2-0-lite-260215', label: '豆包 Seed 2.0 Lite' },
  { value: 'doubao-seed-2-0-mini-260215', label: '豆包 Seed 2.0 Mini' },
  { value: 'doubao-seed-1-8-251228', label: '豆包 Seed 1.8' },
  { value: 'deepseek-v3-2-251201', label: 'DeepSeek V3.2' },
  { value: 'kimi-k2-5-260127', label: 'Kimi K2.5' },
];

const AVAILABLE_SKILLS = [
  { value: 'device_recognition', label: '设备清单识别', type: 'recognition' },
  { value: 'quote_calculation', label: '报价计算', type: 'calculation' },
  { value: 'quota_query', label: '定额查询', type: 'query' },
  { value: 'formula_explanation', label: '公式解释', type: 'explanation' },
  { value: 'report_generation', label: '报告生成', type: 'generation' },
  { value: 'problem_diagnosis', label: '问题诊断', type: 'diagnosis' },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Partial<Agent>>({});
  const [editingSkill, setEditingSkill] = useState<Partial<AgentSkill>>({});
  const { toast } = useToast();

  const loadAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.data || []);
      }
    } catch (error) {
      console.error('加载智能体列表失败:', error);
    }
  };

  const loadSkills = async (agentId: number) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/skills`);
      if (res.ok) {
        const data = await res.json();
        setSkills(data.data || []);
      }
    } catch (error) {
      console.error('加载技能列表失败:', error);
    }
  };

  const loadLogs = async (agentId: number) => {
    try {
      const response = await fetch(`/api/agent-logs?agent_id=${agentId}`);
      const result = await response.json();
      if (response.ok && result.success) setLogs(result.data);
    } catch (error) {
      console.error('加载对话日志失败:', error);
    }
  };

  useEffect(() => {
    void loadAgents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedAgent) {
      void loadSkills(selectedAgent.id);
      void loadLogs(selectedAgent.id);
    }
  }, [selectedAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateAgent = () => {
    setEditingAgent({
      name: '',
      description: '',
      system_prompt: '',
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
      enabled: 1,
    });
    setIsDialogOpen(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setIsDialogOpen(true);
  };

  const handleSaveAgent = async () => {
    try {
      const isEdit = !!editingAgent.id;
      const res = await fetch('/api/agents', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAgent),
      });

      if (res.ok) {
        toast({ title: isEdit ? '更新成功' : '创建成功' });
        setIsDialogOpen(false);
        loadAgents();
      } else {
        const error = await res.json();
        toast({ title: '操作失败', description: error.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: '操作失败', variant: 'destructive' });
    }
  };

  const handleDeleteAgent = async (id: number) => {
    if (!confirm('确定要删除这个智能体吗？')) return;

    try {
      const res = await fetch(`/api/agents?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: '删除成功' });
        if (selectedAgent?.id === id) {
          setSelectedAgent(null);
        }
        loadAgents();
      }
    } catch (error) {
      toast({ title: '删除失败', variant: 'destructive' });
    }
  };

  const handleAddSkill = () => {
    setEditingSkill({
      skill_name: '',
      skill_type: '',
      config_json: '{}',
      enabled: 1,
      priority: 0,
    });
    setIsSkillDialogOpen(true);
  };

  const handleSaveSkill = async () => {
    if (!selectedAgent) return;

    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSkill),
      });

      if (res.ok) {
        toast({ title: '技能添加成功' });
        setIsSkillDialogOpen(false);
        loadSkills(selectedAgent.id);
      }
    } catch (error) {
      toast({ title: '添加失败', variant: 'destructive' });
    }
  };

  const handleDeleteSkill = async (skillId: number) => {
    if (!selectedAgent || !confirm('确定要删除这个技能吗？')) return;

    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/skills?skill_id=${skillId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: '删除成功' });
        loadSkills(selectedAgent.id);
      }
    } catch (error) {
      toast({ title: '删除失败', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">智能体管理</h1>
        <p className="text-muted-foreground">配置和管理ITS报价系统的AI智能体</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 智能体列表 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>智能体列表</span>
              <Button size="sm" onClick={handleCreateAgent}>
                <Plus className="h-4 w-4 mr-1" />
                新建
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedAgent?.id === agent.id
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {agent.enabled ? '已启用' : '已禁用'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditAgent(agent);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAgent(agent.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {agents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  暂无智能体，点击&ldquo;新建&rdquo;创建
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 智能体配置 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              智能体配置
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedAgent ? (
              <Tabs defaultValue="config">
                <TabsList>
                  <TabsTrigger value="config">基本配置</TabsTrigger>
                  <TabsTrigger value="skills">技能管理</TabsTrigger>
                  <TabsTrigger value="logs">对话日志</TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-4">
                  <div>
                    <Label>名称</Label>
                    <Input value={selectedAgent.name} disabled />
                  </div>
                  <div>
                    <Label>描述</Label>
                    <Textarea value={selectedAgent.description} disabled />
                  </div>
                  <div>
                    <Label>系统提示词</Label>
                    <Textarea
                      value={selectedAgent.system_prompt}
                      disabled
                      className="min-h-[200px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>模型</Label>
                      <Input
                        value={AVAILABLE_MODELS.find(m => m.value === selectedAgent.model)?.label || selectedAgent.model}
                        disabled
                      />
                    </div>
                    <div>
                      <Label>温度</Label>
                      <Input value={selectedAgent.temperature} disabled />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="skills">
                  <div className="mb-4">
                    <Button onClick={handleAddSkill}>
                      <Plus className="h-4 w-4 mr-1" />
                      添加技能
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>技能名称</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>优先级</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skills.map((skill) => (
                        <TableRow key={skill.id}>
                          <TableCell>{skill.skill_name}</TableCell>
                          <TableCell>{skill.skill_type}</TableCell>
                          <TableCell>{skill.priority}</TableCell>
                          <TableCell>{skill.enabled ? '启用' : '禁用'}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteSkill(skill.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {skills.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            暂无技能
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="logs">
                  <Table>
                    <TableHeader><TableRow><TableHead>用户</TableHead><TableHead>问题</TableHead><TableHead>回复</TableHead><TableHead>时间</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {logs.map((log) => <TableRow key={log.id}><TableCell>{log.user_name}</TableCell><TableCell className="max-w-48 truncate" title={log.user_message}>{log.user_message}</TableCell><TableCell className="max-w-64 truncate" title={log.agent_response}>{log.agent_response}</TableCell><TableCell>{log.created_at}</TableCell></TableRow>)}
                      {logs.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">暂无对话日志</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>请从左侧选择一个智能体进行配置</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 创建/编辑智能体对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAgent.id ? '编辑智能体' : '新建智能体'}</DialogTitle>
            <DialogDescription>
              配置智能体的基本信息和系统提示词
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input
                value={editingAgent.name}
                onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                placeholder="输入智能体名称"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={editingAgent.description}
                onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })}
                placeholder="输入智能体描述"
              />
            </div>
            <div>
              <Label>系统提示词</Label>
              <Textarea
                value={editingAgent.system_prompt}
                onChange={(e) => setEditingAgent({ ...editingAgent, system_prompt: e.target.value })}
                placeholder="输入系统提示词，定义智能体的行为和角色"
                className="min-h-[150px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>模型</Label>
                <Select
                  value={editingAgent.model}
                  onValueChange={(value) => setEditingAgent({ ...editingAgent, model: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>温度 ({editingAgent.temperature})</Label>
                <Input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editingAgent.temperature}
                  onChange={(e) => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={editingAgent.enabled === 1}
                onCheckedChange={(checked) => setEditingAgent({ ...editingAgent, enabled: checked ? 1 : 0 })}
              />
              <Label htmlFor="enabled">启用智能体</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveAgent}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加技能对话框 */}
      <Dialog open={isSkillDialogOpen} onOpenChange={setIsSkillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加技能</DialogTitle>
            <DialogDescription>
              为智能体添加新的能力
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>技能</Label>
              <Select
                value={editingSkill.skill_name}
                onValueChange={(value) => {
                  const skill = AVAILABLE_SKILLS.find(s => s.value === value);
                  setEditingSkill({
                    ...editingSkill,
                    skill_name: value,
                    skill_type: skill?.type || '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择技能" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_SKILLS.map((skill) => (
                    <SelectItem key={skill.value} value={skill.value}>
                      {skill.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>优先级</Label>
              <Input
                type="number"
                value={editingSkill.priority}
                onChange={(e) => setEditingSkill({ ...editingSkill, priority: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSkillDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSkill}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
