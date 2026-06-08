'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AlertCircle, Lock, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useUser } from '@/contexts/user-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useUser();

  // 管理员登录状态
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminRemember, setAdminRemember] = useState(false);

  // ITS成员登录状态
  const [itsUsername, setItsUsername] = useState('');
  const [itsPassword, setItsPassword] = useState('');
  const [itsError, setItsError] = useState('');
  const [itsLoading, setItsLoading] = useState(false);
  const [itsRemember, setItsRemember] = useState(false);

  // 管理员登录
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);

    try {
      const result = await login('admin', adminPassword);
      
      if (!result.success) {
        setAdminError(result.error || '登录失败');
        setAdminLoading(false);
        return;
      }

      // 记住登录
      if (adminRemember) {
        localStorage.setItem('rememberLogin', 'true');
      }

      router.push('/device-review');
    } catch (err) {
      setAdminError('登录失败，请重试');
      setAdminLoading(false);
    }
  };

  // ITS成员登录
  const handleItsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setItsError('');
    setItsLoading(true);

    try {
      if (!itsUsername) {
        setItsError('请输入用户名');
        setItsLoading(false);
        return;
      }

      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: itsUsername, password: itsPassword, remember: itsRemember })
      });

      const data = await response.json();

      if (!data.success) {
        setItsError(data.error || '登录失败');
        setItsLoading(false);
        return;
      }

      // 存储登录信息（包括姓名）
      localStorage.setItem('authToken', data.data.token);
      localStorage.setItem('userRole', 'its_member');
      localStorage.setItem('itsUsername', itsUsername);
      if (data.data.name) {
        localStorage.setItem('itsName', data.data.name);
      }
      if (itsRemember) {
        localStorage.setItem('rememberLogin', 'true');
      }

      router.push('/device-import');
    } catch (err) {
      setItsError('登录失败，请重试');
      setItsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-800">
            维保报价管理系统
          </CardTitle>
          <CardDescription>
            请选择登录方式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                管理员
              </TabsTrigger>
              <TabsTrigger value="its" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                ITS成员
              </TabsTrigger>
            </TabsList>

            {/* 管理员登录 */}
            <TabsContent value="admin" className="mt-4">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                {adminError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{adminError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="adminPassword">管理员密码</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="请输入管理员密码"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    环境变量 ADMIN_PASSWORD
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="adminRemember"
                    checked={adminRemember}
                    onCheckedChange={(checked) => setAdminRemember(checked as boolean)}
                  />
                  <label
                    htmlFor="adminRemember"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    记住登录（7天内免登录）
                  </label>
                </div>

                <Button type="submit" className="w-full" disabled={adminLoading}>
                  {adminLoading ? '登录中...' : '登录'}
                </Button>
              </form>
            </TabsContent>

            {/* ITS成员登录 */}
            <TabsContent value="its" className="mt-4">
              <form onSubmit={handleItsLogin} className="space-y-4">
                {itsError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{itsError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="itsUsername">用户名</Label>
                  <Input
                    id="itsUsername"
                    type="text"
                    placeholder="请输入用户名"
                    value={itsUsername}
                    onChange={(e) => setItsUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itsPassword">密码</Label>
                  <Input
                    id="itsPassword"
                    type="password"
                    placeholder="请输入密码"
                    value={itsPassword}
                    onChange={(e) => setItsPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="itsRemember"
                    checked={itsRemember}
                    onCheckedChange={(checked) => setItsRemember(checked as boolean)}
                  />
                  <label
                    htmlFor="itsRemember"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    记住登录（7天内免登录）
                  </label>
                </div>

                <Button type="submit" className="w-full" disabled={itsLoading}>
                  {itsLoading ? '登录中...' : '登录'}
                </Button>

                <div className="text-xs text-center space-y-1">
                  <p className="text-muted-foreground">测试账号：demo / demo123</p>
                  <p className="text-muted-foreground">如需开通正式账号，请联系管理员</p>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
