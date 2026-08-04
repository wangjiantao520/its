/**
 * 用户与角色类型定义
 *
 * 设备清单导入相关类型与操作已拆分到 @/lib/device-imports
 * 历史上的 getCurrentUser / switchUserRole 为演示用死代码，已删除
 * （实际用户态从 @/contexts/user-context 获取）
 */

export type UserRole = 'its_member' | 'admin';
export type Role = UserRole;

export const ROLE = {
  ITS_MEMBER: 'its_member' as Role,
  ADMIN: 'admin' as Role
};

export interface User {
  id: string;
  name: string;
  role: UserRole;
  username?: string;  // 登录用户名
}
