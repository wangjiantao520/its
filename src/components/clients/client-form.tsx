'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, User, Phone, Mail, MapPin, Tag, StickyNote, Loader2 } from 'lucide-react';
import type { Client } from './client-list';

interface ClientFormProps {
  client: Client | null;
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  name: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  region: string;
  level: 'normal' | 'vip' | 'partner';
  remark: string;
}

interface FormErrors {
  name?: string;
  contact_phone?: string;
  contact_email?: string;
}

const REGION_OPTIONS = [
  '蕉城', '福安', '福鼎', '霞浦', '周宁', '寿宁', '屏南', '古田', '柘荣',
];

export function ClientForm({ client, token, onSuccess, onCancel }: ClientFormProps) {
  const isEdit = !!client;

  const [form, setForm] = useState<FormData>({
    name: client?.name ?? '',
    contact_person: client?.contact_person ?? '',
    contact_phone: client?.contact_phone ?? '',
    contact_email: client?.contact_email ?? '',
    address: client?.address ?? '',
    region: client?.region ?? '',
    level: client?.level ?? 'normal',
    remark: client?.remark ?? '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const setSelect = (field: keyof FormData) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = '客户名称不能为空';
    }

    if (form.contact_phone && !/^[\d\-\+\(\)\s]{7,20}$/.test(form.contact_phone)) {
      newErrors.contact_phone = '请输入有效的电话号码';
    }

    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      newErrors.contact_email = '请输入有效的邮箱地址';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !token) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const url = isEdit ? `/api/clients/${client.id}` : '/api/clients';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.success) {
        setSubmitError(data.error ?? '保存失败，请重试');
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError('网络错误，请检查网络连接后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client code (read-only, shown on edit) */}
      {isEdit && client?.client_code && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">客户编号：</span>
          <span className="font-mono text-sm font-semibold">{client.client_code}</span>
        </div>
      )}

      {/* Basic info */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">基本信息</CardTitle>
          </div>
          <CardDescription>客户名称和等级信息</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="name">
              客户名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="请输入客户名称"
              value={form.name}
              onChange={set('name')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="region">地区</Label>
            <Select value={form.region} onValueChange={setSelect('region')}>
              <SelectTrigger id="region">
                <SelectValue placeholder="选择地区" />
              </SelectTrigger>
              <SelectContent>
                {REGION_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="level">客户等级</Label>
            <Select
              value={form.level}
              onValueChange={(v) => setSelect('level')(v as FormData['level'])}
            >
              <SelectTrigger id="level">
                <SelectValue placeholder="选择等级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">普通</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="partner">合作伙伴</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">地址</Label>
            <Input
              id="address"
              placeholder="详细地址"
              value={form.address}
              onChange={set('address')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact info */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">联系信息</CardTitle>
          </div>
          <CardDescription>联系人和联系方式</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contact_person">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                联系人
              </span>
            </Label>
            <Input
              id="contact_person"
              placeholder="联系人姓名"
              value={form.contact_person}
              onChange={set('contact_person')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact_phone">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                联系电话
              </span>
            </Label>
            <Input
              id="contact_phone"
              type="tel"
              placeholder="手机或座机"
              value={form.contact_phone}
              onChange={set('contact_phone')}
              className={errors.contact_phone ? 'border-destructive' : ''}
            />
            {errors.contact_phone && (
              <p className="text-xs text-destructive">{errors.contact_phone}</p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="contact_email">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                电子邮箱
              </span>
            </Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="example@domain.com"
              value={form.contact_email}
              onChange={set('contact_email')}
              className={errors.contact_email ? 'border-destructive' : ''}
            />
            {errors.contact_email && (
              <p className="text-xs text-destructive">{errors.contact_email}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Remark */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">备注</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="补充说明客户特殊情况、特殊需求等..."
            rows={3}
            value={form.remark}
            onChange={set('remark')}
          />
        </CardContent>
      </Card>

      {/* Submit error */}
      {submitError && (
        <p className="text-sm text-destructive text-center">{submitError}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? '保存修改' : '创建客户'}
        </Button>
      </div>
    </form>
  );
}
