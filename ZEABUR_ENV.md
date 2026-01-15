# Zeabur 部署环境变量配置指南

本文档说明在 Zeabur 上部署日麻直播记分系统所需的环境变量。

## 🚀 快速开始（基于 Azure 现有资源）

如果您已经在 Azure 上部署了数据库和前端，只需要在 Zeabur 上部署后端，请参考：**[ZEABUR_CONFIG_FROM_AZURE.md](./ZEABUR_CONFIG_FROM_AZURE.md)**

该文档包含：
- 从您的 Azure 脚本中提取的数据库配置信息
- 具体的环境变量值
- 获取前端 URL 的方法
- 部署步骤和故障排查

## 后端服务环境变量

### 必需环境变量

| 变量名 | 说明 | 示例值 | 备注 |
|--------|------|--------|------|
| `PORT` | 服务端口 | `3000` | Zeabur 会自动分配端口，通常使用 `PORT` 环境变量 |
| `NODE_ENV` | 环境模式 | `production` | 生产环境必须设置为 `production` |
| `DB_HOST` | 数据库主机地址 | `your-db-host.zeabur.app` | Zeabur PostgreSQL 服务的主机地址 |
| `DB_PORT` | 数据库端口 | `5432` | PostgreSQL 默认端口 |
| `DB_USERNAME` | 数据库用户名 | `postgres` | Zeabur 提供的数据库用户名 |
| `DB_PASSWORD` | 数据库密码 | `your-password` | Zeabur 提供的数据库密码 |
| `DB_DATABASE` | 数据库名称 | `mahjong_db` | 数据库名称 |
| `JWT_SECRET` | JWT 密钥 | `your-super-secret-jwt-key-here` | **必须使用强随机字符串** |
| `FRONTEND_URL` | 前端地址 | `https://your-app.zeabur.app` | 用于 CORS 配置，支持多个地址（逗号分隔） |

### 可选环境变量

| 变量名 | 说明 | 默认值 | 备注 |
|--------|------|--------|------|
| `JWT_EXPIRES_IN` | JWT Token 过期时间 | `7d` | 例如：`7d`, `24h`, `1h` |
| `REDIS_HOST` | Redis 主机地址 | - | 如果未设置，将使用内存缓存 |
| `REDIS_PORT` | Redis 端口 | `6379` | Redis 默认端口 |
| `REDIS_PASSWORD` | Redis 密码 | - | 如果 Redis 需要密码 |

## 前端服务环境变量

### 必需环境变量

| 变量名 | 说明 | 示例值 | 备注 |
|--------|------|--------|------|
| `VITE_API_URL` | 后端 API 地址 | `https://your-backend.zeabur.app` | 后端服务的完整 URL（包含协议） |
| `VITE_WS_URL` | WebSocket 地址 | `wss://your-backend.zeabur.app` | WebSocket 地址（使用 `wss://` 用于 HTTPS） |

## Zeabur 配置步骤

### 1. 后端服务配置

1. 在 Zeabur 中创建后端服务（从 Docker 镜像或 GitHub 仓库）
2. 添加以下环境变量：

```bash
# 基础配置
NODE_ENV=production
PORT=3000

# 数据库配置（从 Zeabur PostgreSQL 服务获取）
DB_HOST=<zeabur-postgres-host>
DB_PORT=5432
DB_USERNAME=<zeabur-postgres-username>
DB_PASSWORD=<zeabur-postgres-password>
DB_DATABASE=mahjong_db

# JWT 配置（必须生成强密钥）
JWT_SECRET=<generate-a-strong-random-secret>
JWT_EXPIRES_IN=7d

# 前端地址（用于 CORS）
FRONTEND_URL=https://your-frontend.zeabur.app

# Redis 配置（可选，如果使用 Zeabur Redis 服务）
REDIS_HOST=<zeabur-redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<zeabur-redis-password>
```

### 2. 前端服务配置

1. 在 Zeabur 中创建前端服务
2. 添加以下环境变量：

```bash
# 后端 API 地址（使用后端服务的 Zeabur URL）
VITE_API_URL=https://your-backend.zeabur.app

# WebSocket 地址（使用 wss:// 协议）
VITE_WS_URL=wss://your-backend.zeabur.app
```

**注意**：前端环境变量需要在**构建时**设置。如果使用 Docker 构建，需要在 Dockerfile 中使用 `ARG` 和 `ENV`。

### 3. 数据库初始化

首次部署后，数据库表会自动创建（如果 `NODE_ENV=production`，需要手动创建表或使用迁移）。

如果需要创建管理员账户，可以：
1. 通过 API 注册第一个用户
2. 在数据库中手动创建管理员账户

## 重要提示

### 1. JWT_SECRET 生成

使用以下命令生成强随机密钥：

```bash
# 使用 openssl
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. CORS 配置

`FRONTEND_URL` 支持多个地址，用逗号分隔：

```bash
FRONTEND_URL=https://your-app.zeabur.app,https://www.your-domain.com
```

### 3. WebSocket 协议

- 如果使用 HTTPS，WebSocket 必须使用 `wss://`
- 如果使用 HTTP，WebSocket 使用 `ws://`

### 4. 端口配置

Zeabur 会自动分配端口，后端服务应该使用 `PORT` 环境变量（Zeabur 会自动设置）。

### 5. 数据库连接

如果使用 Zeabur 的 PostgreSQL 服务：
- Zeabur 会自动提供连接信息
- 可能需要配置 SSL（代码已自动处理 Azure PostgreSQL，Zeabur 可能也需要）

### 6. Redis（可选）

- Redis 是可选的，如果不配置，系统会使用内存缓存
- 如果使用 Zeabur 的 Redis 服务，配置相应的环境变量即可

## 环境变量检查清单

部署前请确认：

- [ ] `NODE_ENV=production`（后端）
- [ ] `DB_HOST`、`DB_USERNAME`、`DB_PASSWORD`、`DB_DATABASE` 已配置（后端）
- [ ] `JWT_SECRET` 已设置且足够强（后端）
- [ ] `FRONTEND_URL` 已设置为前端地址（后端）
- [ ] `VITE_API_URL` 已设置为后端地址（前端）
- [ ] `VITE_WS_URL` 已设置为后端 WebSocket 地址（前端，使用 `wss://`）

## 故障排查

### 后端无法连接数据库

1. 检查数据库环境变量是否正确
2. 确认 Zeabur PostgreSQL 服务已启动
3. 检查网络连接（Zeabur 服务间通常自动连接）

### CORS 错误

1. 确认 `FRONTEND_URL` 设置为正确的前端地址
2. 检查前端地址是否包含协议（`https://`）
3. 如果使用自定义域名，确保也添加到 `FRONTEND_URL`

### WebSocket 连接失败

1. 确认 `VITE_WS_URL` 使用正确的协议（`wss://` 用于 HTTPS）
2. 检查后端服务是否正常运行
3. 确认防火墙/网络配置允许 WebSocket 连接

### 前端无法连接后端

1. 确认 `VITE_API_URL` 设置为正确的后端地址
2. 检查后端服务是否正常运行
3. 查看浏览器控制台的错误信息
