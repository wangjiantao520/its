'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AlertCircle, Building2, Users, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUser } from '@/contexts/user-context';
import { TiltCard } from '@/components/ui/tilt-card';
import { readApiResponse, type ApiResponse } from '@/lib/api-response';

interface MemberLoginResponse {
  token: string;
  userId?: number;
  name?: string;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get('role');
  const { login, isLoggedIn } = useUser();

  // 如果已登录，显示提示
  if (isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">您已登录</h1>
          <p className="text-muted-foreground mb-6">您可以直接访问系统功能</p>
          <Button onClick={() => window.location.href = '/'}>
            进入系统
          </Button>
        </div>
      </div>
    );
  }

  // 当前视图：select（选择入口）/ admin（管理员登录）/ its（成员登录）
  const [view, setView] = useState<'select' | 'admin' | 'its'>(
    roleFromUrl === 'admin' ? 'admin' : roleFromUrl === 'its' ? 'its' : 'select'
  );

  // 管理员登录状态
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // ITS成员登录状态
  const [itsUsername, setItsUsername] = useState('');
  const [itsPassword, setItsPassword] = useState('');
  const [itsError, setItsError] = useState('');
  const [itsLoading, setItsLoading] = useState(false);

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

      window.location.href = '/';
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
        body: JSON.stringify({ username: itsUsername, password: itsPassword })
      });

      const data = await readApiResponse(response) as ApiResponse<MemberLoginResponse>;

      if (!data.success || !data.data?.token) {
        setItsError(data.error || '登录失败');
        setItsLoading(false);
        return;
      }

      localStorage.setItem('authToken', data.data.token);
      localStorage.setItem('userRole', 'its_member');
      localStorage.setItem('itsUsername', itsUsername);
      if (data.data.name) localStorage.setItem('itsName', data.data.name);
      if (data.data.userId) localStorage.setItem('itsUserId', data.data.userId.toString());

      window.location.href = '/device-import';
    } catch (err) {
      setItsError('登录失败，请重试');
      setItsLoading(false);
    }
  };

  // 选择入口视图
  if (view === 'select') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          {/* Logo标题 */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              维保报价管理系统
            </h1>
            <p className="text-muted-foreground text-base">
              请选择登录入口
            </p>
          </div>

          {/* 两个入口卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 管理端入口 */}
            <TiltCard
              max={6}
              perspective={1000}
              glareOpacity={0.1}
              scale={1.02}
              className="cursor-pointer"
              onClick={() => setView('admin')}
            >
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                  <Building2 className="w-8 h-8 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  管理端
                </h3>
                <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                  管理员使用
                  <br />
                  数据看板 · 成员管理 · 智能体配置
                </p>
                <Button variant="default" className="w-full h-10">
                  进入管理端
                </Button>
              </CardContent>
            </TiltCard>

            {/* 成员端入口 */}
            <TiltCard
              max={6}
              perspective={1000}
              glareOpacity={0.1}
              scale={1.02}
              className="cursor-pointer"
              onClick={() => setView('its')}
            >
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-terracotta/10 flex items-center justify-center mb-5">
                  <Users className="w-8 h-8 text-terracotta" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  ITS成员端
                </h3>
                <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                  ITS成员使用
                  <br />
                  工程报价 · 维保报价 · 智能助手
                </p>
                <Button
                  variant="default"
                  className="w-full h-10"
                  style={{
                    background: 'linear-gradient(135deg, #d4a679 0%, #c8956e 100%)',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  进入成员端
                </Button>
              </CardContent>
            </TiltCard>
          </div>

        </div>
      </div>
    );
  }

  // 登录表单视图
  const isAdmin = view === 'admin';

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* 返回按钮 */}
        <button
          onClick={() => setView('select')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回选择入口
        </button>

        <TiltCard max={4} perspective={1200} glareOpacity={0.08} scale={1.01}>
          <CardContent className="p-8">
            {/* 标题图标 */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                isAdmin ? 'bg-primary/10' : 'bg-terracotta/10'
              }`}>
                {isAdmin ? (
                  <ShieldCheck className="w-7 h-7 text-primary" strokeWidth={1.5} />
                ) : (
                  <Users className="w-7 h-7 text-terracotta" strokeWidth={1.5} />
                )}
              </div>
              <CardTitle className="text-xl font-semibold text-foreground">
                {isAdmin ? '管理端登录' : 'ITS成员登录'}
              </CardTitle>
            </div>

            {/* 管理员登录表单 */}
            {isAdmin ? (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                {adminError && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{adminError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="adminPassword" className="text-sm font-medium">
                    管理员密码
                  </Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="请输入密码"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base"
                  disabled={adminLoading}
                >
                  {adminLoading ? '登录中...' : '登 录'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleItsLogin} className="space-y-4">
                {itsError && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{itsError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="itsUsername" className="text-sm font-medium">
                    用户名
                  </Label>
                  <Input
                    id="itsUsername"
                    type="text"
                    placeholder="请输入用户名"
                    value={itsUsername}
                    onChange={(e) => setItsUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itsPassword" className="text-sm font-medium">
                    密码
                  </Label>
                  <Input
                    id="itsPassword"
                    type="password"
                    placeholder="请输入密码"
                    value={itsPassword}
                    onChange={(e) => setItsPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base"
                  style={{
                    background: 'linear-gradient(135deg, #d4a679 0%, #c8956e 100%)',
                    color: 'white',
                    border: 'none'
                  }}
                  disabled={itsLoading}
                >
                  {itsLoading ? '登录中...' : '登 录'}
                </Button>

                <p className="text-xs text-center text-muted-foreground/70">
                  如需开通账号，请联系管理员
                </p>
              </form>
            )}
          </CardContent>
        </TiltCard>
      </div>
    </div>
  );
}

function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-foreground/60">加载中...</div>
    </div>}>
      <LoginContent />
    </Suspense>
  );
}

export default LoginPage;
