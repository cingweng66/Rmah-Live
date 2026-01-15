# 开发者调试指南

## 🚀 快速开始

### 一键启动（推荐）

```bash
# 启动整个开发环境（前后端 + 数据库）
./dev-start.sh
# 或
npm run dev:start
```

这个脚本会：
- ✅ 自动检查并创建配置文件
- ✅ 自动安装依赖
- ✅ 启动后端服务（Docker 或本地模式）
- ✅ 启动前端服务
- ✅ 等待服务就绪并显示访问地址

### 手动启动

如果需要分别启动：

```bash
# 终端1：启动后端
cd backend
./start-docker.sh  # 或 ./start-local.sh

# 终端2：启动前端
npm run dev
```

## 🔍 调试工具

### 1. 健康检查

```bash
./dev-check.sh
# 或
npm run dev:check
```

检查：
- ✅ 后端服务状态
- ✅ 前端服务状态
- ✅ 数据库连接
- ✅ Redis 连接
- ✅ API 端点可用性

### 2. 查看日志

```bash
./dev-logs.sh
# 或
npm run dev:logs
```

选项：
- 1) 后端日志
- 2) 前端日志
- 3) 数据库日志
- 4) Redis 日志
- 5) 所有日志（合并）
- 6) Docker 容器日志

### 3. 创建测试用户

```bash
./dev-test-user.sh [邮箱] [密码] [姓名]
# 或
npm run dev:test-user

# 示例
./dev-test-user.sh test@example.com test123 测试用户
```

快速创建测试账号，系统会自动创建并激活 License。

### 4. 配置管理

```bash
./dev-config.sh
# 或
npm run dev:config
```

功能：
- 查看当前配置
- 重置配置文件
- 生成生产环境配置
- 检查配置完整性

### 5. 重置开发环境

```bash
./dev-reset.sh
# 或
npm run dev:reset
```

⚠️ **警告**：会清空所有数据！
- 停止所有服务
- 清理数据库
- 清理 Redis 缓存
- 清理构建文件
- 清理日志文件

## 📝 配置文件

### 自动生成

首次运行 `./dev-start.sh` 会自动创建：
- `.env` - 前端配置
- `backend/.env` - 后端配置

### 手动配置

#### 前端配置 (.env)

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

#### 后端配置 (backend/.env)

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=mahjong_db

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# 应用配置
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
```

## 🐛 调试技巧

### 1. 后端调试

#### 查看实时日志

```bash
cd backend
npm run start:dev
```

#### 调试模式

```bash
cd backend
npm run start:debug
```

然后使用 Chrome DevTools 连接：`chrome://inspect`

#### 检查 API

```bash
# 健康检查
curl http://localhost:3000/health

# API 信息
curl http://localhost:3000/game
curl http://localhost:3000/auth
```

### 2. 前端调试

#### 开发模式

```bash
npm run dev
```

访问：http://localhost:8080

#### 浏览器调试

- 打开 Chrome DevTools (F12)
- Network 标签：查看 API 请求
- Console 标签：查看日志和错误
- Application 标签：查看 LocalStorage

### 3. 数据库调试

#### 使用 Docker

```bash
# 进入 PostgreSQL 容器
docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d mahjong_db

# 查看表
\dt

# 查询用户
SELECT * FROM users;

# 查询 License
SELECT * FROM licenses;
```

#### 使用本地 PostgreSQL

```bash
psql -h localhost -U postgres -d mahjong_db
```

### 4. Redis 调试

#### 使用 Docker

```bash
# 进入 Redis 容器
docker exec -it $(docker ps -q -f name=redis) redis-cli

# 查看所有键
KEYS *

# 查看缓存
GET license:user:xxx
```

#### 使用本地 Redis

```bash
redis-cli -h localhost -p 6379
```

## 🔧 常见问题

### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3000  # 后端
lsof -i :8080  # 前端
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# 杀死进程
kill -9 <PID>
```

### 数据库连接失败

1. 检查数据库是否运行：`./dev-check.sh`
2. 检查配置：`./dev-config.sh`
3. 检查连接字符串：`backend/.env`

### WebSocket 连接失败

1. 检查后端是否运行：`curl http://localhost:3000/health`
2. 检查 Token：浏览器控制台查看
3. 检查 CORS 配置：`backend/src/main.ts`

### 依赖安装失败

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install

# 后端
cd backend
rm -rf node_modules package-lock.json
npm install
```

## 📊 性能监控

### 查看资源使用

```bash
# Docker 容器资源
docker stats

# 系统资源
top
# 或
htop
```

### API 性能测试

```bash
# 使用 curl 测试响应时间
time curl http://localhost:3000/health

# 使用 ab (Apache Bench)
ab -n 1000 -c 10 http://localhost:3000/health
```

## 🎯 开发工作流

### 日常开发

1. **启动环境**
   ```bash
   ./dev-start.sh
   ```

2. **开发功能**
   - 修改代码
   - 查看日志：`./dev-logs.sh`
   - 检查状态：`./dev-check.sh`

3. **测试功能**
   - 创建测试用户：`./dev-test-user.sh`
   - 访问前端：http://localhost:8080
   - 测试 API：http://localhost:3000/game

4. **调试问题**
   - 查看日志
   - 检查配置
   - 重置环境（如需要）：`./dev-reset.sh`

### 提交代码前

1. 运行检查：`./dev-check.sh`
2. 运行测试：`npm test`（如果有）
3. 检查代码：`npm run lint`
4. 构建测试：`npm run build`

## 💡 提示

- 使用 `./dev-start.sh` 一键启动，自动处理所有配置
- 使用 `./dev-check.sh` 快速诊断问题
- 使用 `./dev-logs.sh` 查看实时日志
- 使用 `./dev-test-user.sh` 快速创建测试账号
- 遇到问题先运行 `./dev-check.sh` 检查状态
