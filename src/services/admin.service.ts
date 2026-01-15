import api from './api';

export interface RegistrationCode {
  id: string;
  code: string;
  isActive: boolean;
  usedBy: string | null;
  usedAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const adminService = {
  /**
   * 获取所有注册码
   */
  async getAllCodes(): Promise<RegistrationCode[]> {
    const response = await api.get('/admin/registration-codes');
    return response.data;
  },

  /**
   * 创建注册码
   */
  async createCode(note?: string): Promise<RegistrationCode> {
    const response = await api.post('/admin/registration-codes', { note });
    return response.data;
  },

  /**
   * 删除注册码
   */
  async deleteCode(id: string): Promise<void> {
    await api.delete(`/admin/registration-codes/${id}`);
  },

  /**
   * 切换注册码状态（启用/停用）
   */
  async toggleCodeStatus(id: string): Promise<RegistrationCode> {
    const response = await api.patch(`/admin/registration-codes/${id}/toggle`);
    return response.data;
  },

  /**
   * 获取所有用户
   */
  async getAllUsers(): Promise<User[]> {
    const response = await api.get('/admin/users');
    return response.data;
  },

  /**
   * 重置用户密码
   */
  async resetUserPassword(id: string, newPassword?: string): Promise<{ message: string; newPassword: string }> {
    const response = await api.post(`/admin/users/${id}/reset-password`, { newPassword });
    return response.data;
  },

  /**
   * 切换用户状态（启用/停用）
   */
  async toggleUserStatus(id: string): Promise<{ message: string; user: User }> {
    const response = await api.post(`/admin/users/${id}/toggle-status`);
    return response.data;
  },
};
