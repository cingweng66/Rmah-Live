import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 公开端点（/game/public/*）不需要认证，不应该重定向
    const isPublicEndpoint = error.config?.url?.includes('/game/public/');
    
    if (error.response?.status === 401 && !isPublicEndpoint) {
      // Token 过期或无效，清除本地存储
      // 但公开端点不需要认证，不应该重定向
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      // 只在非公开页面才重定向
      if (!window.location.hash.includes('display-public')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
