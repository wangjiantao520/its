'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Database, Settings, Save } from 'lucide-react';

export default function DatabasePage() {
  const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: '3306',
    user: 'root',
    database: 'quotation_system'
  });

  const initDatabase = async () => {
    setDbStatus('loading');
    setStatusMessage('正在初始化数据库...');

    try {
      const response = await fetch('/api/init-db');
      const result = await response.json();

      if (result.success) {
        setDbStatus('success');
        setStatusMessage(result.message);
      } else {
        setDbStatus('error');
        setStatusMessage(result.message);
      }
    } catch (error) {
      setDbStatus('error');
      setStatusMessage('初始化失败: ' + String(error));
    }
  };

  const saveConfig = () => {
    alert('配置已保存！请在服务器端设置环境变量。\n\n环境变量示例:\nDB_HOST=' + dbConfig.host + '\nDB_PORT=' + dbConfig.port + '\nDB_USER=' + dbConfig.user + '\nDB_NAME=' + dbConfig.database);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">数据库管理</h1>
        <p className="text-slate-600 mt-1">配置和管理MySQL数据库</p>
      </div>

      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">
            <Database className="w-4 h-4 mr-2" />
            数据库状态
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="w-4 h-4 mr-2" />
            配置设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                数据库初始化
              </CardTitle>
              <CardDescription>
                初始化数据库表结构，创建工程报价表、维保报价表和设备定额表
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-2">将创建以下数据表：</h3>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• <code>engineering_quotes</code> - 工程报价记录表</li>
                  <li>• <code>maintenance_quotes</code> - 维保报价记录表</li>
                  <li>• <code>device_quotas</code> - 设备定额库表</li>
                </ul>
              </div>

              {statusMessage && (
                <div className={`p-4 rounded-lg flex items-start gap-3 ${
                  dbStatus === 'success' ? 'bg-green-50 text-green-800' :
                  dbStatus === 'error' ? 'bg-red-50 text-red-800' :
                  'bg-blue-50 text-blue-800'
                }`}>
                  {dbStatus === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
                  {dbStatus === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                  <div>{statusMessage}</div>
                </div>
              )}

              <div className="flex gap-3">
                <Button 
                  onClick={initDatabase}
                  disabled={dbStatus === 'loading'}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {dbStatus === 'loading' ? '初始化中...' : '初始化数据库'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
              <CardDescription>数据库配置和使用说明</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <div>
                <h4 className="font-medium text-slate-900 mb-1">1. 环境变量配置</h4>
                <p>在项目根目录创建 <code>.env</code> 文件，配置数据库连接信息：</p>
                <pre className="mt-2 p-3 bg-slate-100 rounded text-xs overflow-x-auto">
{`DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=quotation_system`}
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-1">2. 数据库创建</h4>
                <p>请先在MySQL中创建数据库：</p>
                <pre className="mt-2 p-3 bg-slate-100 rounded text-xs">
                  CREATE DATABASE quotation_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-1">3. 初始化表结构</h4>
                <p>点击上方"初始化数据库"按钮创建数据表</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>数据库连接配置</CardTitle>
              <CardDescription>配置MySQL数据库连接参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">主机地址</Label>
                  <Input
                    id="host"
                    value={dbConfig.host}
                    onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">端口</Label>
                  <Input
                    id="port"
                    value={dbConfig.port}
                    onChange={(e) => setDbConfig({ ...dbConfig, port: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user">用户名</Label>
                  <Input
                    id="user"
                    value={dbConfig.user}
                    onChange={(e) => setDbConfig({ ...dbConfig, user: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database">数据库名</Label>
                  <Input
                    id="database"
                    value={dbConfig.database}
                    onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={saveConfig} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                保存配置
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
