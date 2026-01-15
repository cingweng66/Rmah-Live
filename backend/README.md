# 日麻直播记分系统 - 后端

基于 NestJS 的企业级后端服务，支持实时游戏状态同步和授权管理。

## 技术栈

- **框架**: NestJS
- **数据库**: PostgreSQL + TypeORM
- **缓存**: Redis
- **认证**: JWT + License Key
- **实时通信**: Socket.io (WebSocket)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

### 3. 启动数据库和 Redis（使用 Docker）

```bash
docker-compose up -d postgres redis
```

### 4. 运行应用

开发模式：
```bash
npm run start:dev
```

生产模式：
```bash
npm run build
npm run start:prod
```

## Docker 部署

### 使用 Docker Compose（推荐）

```bash
# 启动所有服务（数据库、Redis、后端）
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down
```

### 单独构建镜像

```bash
docker build -t mahjong-backend .
docker run -p 3000:3000 --env-file .env mahjong-backend
```

## API 文档

### 认证接口

- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录
- `POST /auth/activate-license` - 激活 License
- `GET /auth/license` - 获取 License 信息
- `GET /auth/profile` - 获取用户信息

### 游戏接口

- `GET /game/state/:gameId` - 获取游戏状态
- `POST /game/state` - 更新游戏状态
- `GET /game/sessions` - 获取用户游戏会话列表

### WebSocket

连接地址: `ws://localhost:3000/game`

事件：
- `join-game` - 加入游戏房间
- `leave-game` - 离开游戏房间
- `game-update` - 更新游戏状态
- `game-state` - 接收游戏状态更新

## License 系统

### 生成 License Key

License Key 格式：`XXXX-XXXX-XXXX-XXXX`

可以通过数据库直接创建，或使用管理接口（需要实现）。

### License 验证流程

1. 用户注册/登录
2. 激活 License Key
3. 系统验证 License 有效性
4. 生成 JWT Token（包含授权信息）
5. 每次请求验证 Token 和 License 状态

## 数据库迁移

TypeORM 在开发模式下会自动同步数据库结构。生产环境建议使用迁移：

```bash
# 生成迁移
npm run typeorm migration:generate -- -n MigrationName

# 运行迁移
npm run typeorm migration:run
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务端口 | 3000 |
| NODE_ENV | 环境模式 | development |
| FRONTEND_URL | 前端地址 | http://localhost:8080 |
| DB_HOST | 数据库主机 | localhost |
| DB_PORT | 数据库端口 | 5432 |
| DB_USERNAME | 数据库用户名 | postgres |
| DB_PASSWORD | 数据库密码 | postgres |
| DB_DATABASE | 数据库名称 | mahjong_db |
| REDIS_HOST | Redis 主机 | localhost |
| REDIS_PORT | Redis 端口 | 6379 |
| JWT_SECRET | JWT 密钥 | - |
| JWT_EXPIRES_IN | JWT 过期时间 | 7d |

## 生产环境部署

### VPS 部署步骤

1. **安装 Docker 和 Docker Compose**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

2. **克隆项目并配置**
```bash
git clone <your-repo>
cd backend
cp .env.example .env
# 编辑 .env 文件，设置生产环境配置
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **配置 Nginx 反向代理（可选）**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 安全建议

1. **更改 JWT_SECRET**：使用强随机字符串
2. **使用 HTTPS**：生产环境必须使用 HTTPS
3. **数据库密码**：使用强密码
4. **Redis 密码**：生产环境启用 Redis 密码
5. **防火墙**：只开放必要端口

## 故障排查

### 数据库连接失败

检查：
- 数据库服务是否运行
- 连接信息是否正确
- 防火墙是否开放端口

### Redis 连接失败

检查：
- Redis 服务是否运行
- 连接信息是否正确

### WebSocket 连接失败

检查：
- CORS 配置
- Token 是否有效
- 网络连接

## 许可证

私有项目，保留所有权利。
