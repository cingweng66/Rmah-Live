import api from './api';

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  registrationCode: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authService = {
  /**
   * 用户注册
   */
  async register(data: RegisterData): Promise<LoginResponse> {
    const response = await api.post('/auth/register', data);
    const result = response.data;
    localStorage.setItem('authToken', result.accessToken);
    localStorage.setItem('user', JSON.stringify(result.user));
    return result;
  },

  /**
   * 用户登录
   */
  async login(data: LoginData): Promise<LoginResponse> {
    const response = await api.post('/auth/login', data);
    const result = response.data;
    localStorage.setItem('authToken', result.accessToken);
    localStorage.setItem('user', JSON.stringify(result.user));
    return result;
  },

  /**
   * 激活 License
   */
  async activateLicense(licenseKey: string) {
    const response = await api.post('/auth/activate-license', { licenseKey });
    return response.data;
  },

  /**
   * 获取 License 信息
   */
  async getLicenseInfo() {
    const response = await api.get('/auth/license');
    return response.data;
  },

  /**
   * 获取用户信息
   */
  async getProfile() {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  /**
   * 登出
   */
  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  },

  /**
   * 获取当前用户
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * 获取 Token
   */
  getToken(): string | null {
    return localStorage.getItem('authToken');
  },
};
