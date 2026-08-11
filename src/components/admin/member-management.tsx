'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Users, UserCheck, UserX } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { apiFetch } from '@/lib/api-fetch';
import { useConfirm } from '@/hooks/use-confirm';

interface User {
  id: number;
  username: string;
  name: string | null;
  role: string;
  is_active: number;
  created_at: string;
  created_by: string;
}

export default function MemberManagement() {
  const { token, isLoggedIn, user } = useUser();
  const { confirm, ConfirmDialog } = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // 新建用户表单
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'its_member'>('its_member');

  // 编辑用户表单
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editRole, setEditRole] = useState<'admin' | 'its_member'>('its_member');

  // 加载用户列表
  const loadUsers = async () => {
    if (!token) return;

    try {
      const result = await apiFetch<User[]>('/api/users');
      if (result.success && result.data) {
        setUsers(result.data);
      } else {
        setError(result.error || '加载失败');
      }
    } catch (err) {
      setError('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && user?.role === 'admin') void loadUsers();
  }, [isLoggedIn, user, token]);

  // 创建用户
  const handleCreateUser = async () => {
    if (!newUsername || !newPassword) {
      setError('用户名和密码不能为空');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const result = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          name: newName || newUsername,
          role: newRole,
        }),
      });

      if (result.success) {
        setShowAddDialog(false);
        setNewUsername('');
        setNewPassword('');
        setNewName('');
        setNewRole('its_member');
        loadUsers();
      } else {
        setError(result.error || '创建失败');
      }
    } catch (err) {
      setError('创建用户失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 编辑用户
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditName(user.name || user.username);
    setEditPassword('');
    setEditActive(!!user.is_active);
    setEditRole(user.role === 'admin' ? 'admin' : 'its_member');
    setShowEditDialog(true);
    setError('');
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingUser) return;

    setActionLoading(true);
    setError('');

    const updateData: { name: string; password?: string; is_active?: 1 | 0; role?: 'admin' | 'its_member' } = {
      name: editName
    };

    if (editPassword) {
      updateData.password = editPassword;
    }

    if (editActive !== !!editingUser.is_active) {
      updateData.is_active = editActive ? 1 : 0;
    }

    if (editRole !== editingUser.role) {
      updateData.role = editRole;
    }

    try {
      const result = await apiFetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      if (result.success) {
        setShowEditDialog(false);
        setEditingUser(null);
        loadUsers();
      } else {
        setError(result.error || '更新失败');
      }
    } catch (err) {
      setError('更新用户失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: number) => {
    if (!await confirm({
      title: '删除用户',
      description: '确定要删除这个用户吗？此操作不可恢复。',
      confirmText: '删除',
    })) return;

    setActionLoading(true);
    setError('');

    try {
      const result = await apiFetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      if (result.success) {
        loadUsers();
      } else {
        setError(result.error || '删除失败');
      }
    } catch (err) {
      setError('删除用户失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">账号管理</h1>
            <p className="text-muted-foreground">管理管理员和ITS成员的账号与权限</p>
          </div>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建账号
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建账号</DialogTitle>
              <DialogDescription>创建一个新的管理员或ITS成员登录账号</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <div className="text-sm text-red-500">{error}</div>
              )}

              <div className="space-y-2">
                <Label htmlFor="newUsername">用户名</Label>
                <Input
                  id="newUsername"
                  placeholder="请输入用户名"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">密码</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="请输入密码（至少6位）"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newName">显示名称（可选）</Label>
                <Input
                  id="newName"
                  placeholder="请输入显示名称"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newRole">角色</Label>
                <select
                  id="newRole"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'its_member')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="its_member">ITS成员</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                取消
              </Button>
              <Button onClick={handleCreateUser} disabled={actionLoading}>
                {actionLoading ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>账号列表</CardTitle>
          <CardDescription>共 {users.length} 个账号</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>显示名称</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>创建人</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    暂无账号，点击上方按钮创建第一个账号
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? '管理员' : 'ITS成员'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? (
                          <><UserCheck className="h-3 w-3 mr-1" /> 启用</>
                        ) : (
                          <><UserX className="h-3 w-3 mr-1" /> 禁用</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.created_by}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改用户信息</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm text-red-500">{error}</div>
            )}

            <div className="space-y-2">
              <Label>用户名</Label>
              <Input value={editingUser?.username || ''} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editName">显示名称</Label>
              <Input
                id="editName"
                placeholder="请输入显示名称"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editPassword">新密码（留空则不修改）</Label>
              <Input
                id="editPassword"
                type="password"
                placeholder="请输入新密码（至少6位）"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editRole">角色</Label>
              <select
                id="editRole"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'admin' | 'its_member')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="its_member">ITS成员</option>
                <option value="admin">管理员</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="editActive">启用账号</Label>
              <Switch
                id="editActive"
                checked={editActive}
                onCheckedChange={setEditActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={actionLoading}>
              {actionLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
