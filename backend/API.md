# API 文档

## 基础信息

- 基础 URL: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/game`

## 健康检查

### GET /

根路径，返回服务状态

**响应:**
```json
{
  "status": "ok",
  "message": "日麻直播记分系统后端服务运行中",
  "timestamp": "2026-01-13T12:00:00.000Z",
  "version": "1.0.0"
}
```

### GET /health

健康检查端点

**响应:**
```json
{
  "status": "ok",
  "service": "mahjong-backend",
  "timestamp": "2026-01-13T12:00:00.000Z"
}
```

## 认证接口

### POST /auth/register

用户注册

**请求体:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名"
}
```

**响应:**
```json
{
  "accessToken": "jwt-token-here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "用户名"
  }
}
```

### POST /auth/login

用户登录

**请求体:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应:**
```json
{
  "accessToken": "jwt-token-here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "用户名"
  }
}
```

### POST /auth/activate-license

激活 License Key（需要认证）

**Headers:**
```
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX"
}
```

**响应:**
```json
{
  "message": "License activated successfully",
  "license": {
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "expiresAt": "2027-01-13T12:00:00.000Z"
  }
}
```

### GET /auth/license

获取 License 信息（需要认证）

**Headers:**
```
Authorization: Bearer <token>
```

**响应:**
```json
{
  "hasLicense": true,
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "expiresAt": "2027-01-13T12:00:00.000Z",
  "isExpired": false
}
```

### GET /auth/profile

获取用户信息（需要认证和有效 License）

**Headers:**
```
Authorization: Bearer <token>
```

**响应:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "用户名"
  }
}
```

## 游戏接口

### GET /game/state/:gameId

获取游戏状态（需要认证和有效 License）

**Headers:**
```
Authorization: Bearer <token>
```

**响应:**
```json
{
  "gameId": "default",
  "state": {
    "players": [...],
    "roundWind": "东",
    "roundNumber": 1,
    ...
  }
}
```

### POST /game/state

更新游戏状态（需要认证和有效 License）

**Headers:**
```
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "gameId": "default",
  "state": {
    "players": [...],
    "roundWind": "东",
    "roundNumber": 1,
    ...
  }
}
```

**响应:**
```json
{
  "message": "Game state updated successfully"
}
```

### GET /game/sessions

获取用户游戏会话列表（需要认证和有效 License）

**Headers:**
```
Authorization: Bearer <token>
```

**响应:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "gameId": "default",
      "isActive": true,
      "createdAt": "2026-01-13T12:00:00.000Z"
    }
  ]
}
```

## WebSocket 接口

### 连接

```
ws://localhost:3000/game
```

**认证:**
连接时需要在 `auth` 中传递 token：
```javascript
const socket = io('http://localhost:3000/game', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### 事件

#### 客户端 → 服务器

**join-game**
加入游戏房间
```javascript
socket.emit('join-game', { gameId: 'default' });
```

**leave-game**
离开游戏房间
```javascript
socket.emit('leave-game', { gameId: 'default' });
```

**game-update**
更新游戏状态
```javascript
socket.emit('game-update', {
  gameId: 'default',
  state: { ... }
});
```

#### 服务器 → 客户端

**game-state**
接收游戏状态更新
```javascript
socket.on('game-state', (state) => {
  console.log('Game state updated:', state);
});
```

**error**
错误信息
```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

## 错误响应

所有错误响应格式：
```json
{
  "statusCode": 400,
  "message": "错误信息",
  "error": "错误类型"
}
```

常见状态码：
- `200` - 成功
- `201` - 创建成功
- `400` - 请求错误
- `401` - 未认证
- `403` - 无权限（License 无效）
- `404` - 未找到
- `500` - 服务器错误

## 使用示例

### 使用 curl

```bash
# 健康检查
curl http://localhost:3000/health

# 注册
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456","name":"测试用户"}'

# 登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# 获取用户信息（需要 token）
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 使用 JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 登录
const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  localStorage.setItem('authToken', response.data.accessToken);
  return response.data;
};
```
