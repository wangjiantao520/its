'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AlertCircle, Lock, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserRole } from '@/lib/roles';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useUser();
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!selectedRole) {
        setError('请选择角色');
        setIsLoading(false);
        return;
      }

      if (!password) {
        setError('请输入密码');
        setIsLoading(false);
        return;
      }

      // 调用服务端认证
      const result = await login(selectedRole, password);

      if (!result.success) {
        setError(result.error || '登录失败');
        setIsLoading(false);
        return;
      }

      // 登录成功，跳转到对应页面
      if (selectedRole === 'admin') {
        router.push('/device-review');
      } else {
        router.push('/device-import');
      }
    } catch (err) {
      setError('登录失败，请重试');
      setIsLoading(false);
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
            请选择角色并输入密码登录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>选择角色</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={selectedRole === 'its_member' ? 'default' : 'secondary'}
                  onClick={() => setSelectedRole('its_member')}
                  className="flex items-center justify-center gap-2"
                >
                  <User className="h-4 w-4" />
                  ITS成员
                </Button>
                <Button
                  type="button"
                  variant={selectedRole === 'admin' ? 'default' : 'secondary'}
                  onClick={() => setSelectedRole('admin')}
                  className="flex items-center justify-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  管理员
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
