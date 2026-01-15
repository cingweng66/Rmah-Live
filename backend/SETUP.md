# 环境设置指南

## 问题：Docker 未安装

如果遇到 `docker: command not found` 错误，有两种解决方案：

## 方案 1：安装 Docker Desktop（推荐）

### macOS

1. 下载 Docker Desktop for Mac
   - 访问：https://www.docker.com/products/docker-desktop
   - 或使用 Homebrew：`brew install --cask docker`

2. 安装并启动 Docker Desktop
   - 打开 Docker Desktop 应用
   - 等待 Docker 完全启动（菜单栏图标不再闪烁）

3. 验证安装
   ```bash
   docker --version
   docker compose version
   ```

4. 使用 Docker 启动
   ```bash
   cd backend
   ./start-docker.sh
   ```

## 方案 2：本地安装 PostgreSQL 和 Redis（不使用 Docker）

### macOS 安装

```bash
# 安装 PostgreSQL
brew install postgresql@15

# 启动 PostgreSQL
brew services start postgresql@15

# 安装 Redis
brew install redis

# 启动 Redis
brew services start redis
```

### 创建数据库

```bash
# 创建数据库
createdb -U postgres mahjong_db

# 或使用 psql
psql -U postgres
CREATE DATABASE mahjong_db;
\q
```

### 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，确保配置正确：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=你的密码（如果有）
DB_DATABASE=mahjong_db

REDIS_HOST=localhost
REDIS_PORT=6379
```

### 启动服务

```bash
cd backend
./start-local.sh
```

## 方案 3：使用云数据库（最简单）

如果不想在本地安装数据库，可以使用云服务：

### Supabase（免费 PostgreSQL）

1. 注册账户：https://supabase.com
2. 创建新项目
3. 获取连接信息
4. 更新 `.env` 文件：

```env
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=你的密码
DB_DATABASE=postgres
```

### Redis Cloud（免费 Redis）

1. 注册账户：https://redis.com/try-free/
2. 创建免费数据库
3. 获取连接信息
4. 更新 `.env` 文件：

```env
REDIS_HOST=redis-xxxxx.cloud.redislabs.com
REDIS_PORT=xxxxx
REDIS_PASSWORD=你的密码
```

## 验证服务运行

### 检查 PostgreSQL

```bash
# 检查服务状态
pg_isready -U postgres

# 或连接测试
psql -U postgres -d mahjong_db -c "SELECT 1;"
```

### 检查 Redis

```bash
# 检查服务状态
redis-cli ping
# 应该返回: PONG
```

## 常见问题

### PostgreSQL 连接失败

1. 检查服务是否运行：
   ```bash
   brew services list | grep postgresql
   ```

2. 检查端口是否被占用：
   ```bash
   lsof -i :5432
   ```

3. 检查用户权限：
   ```bash
   psql -U postgres -l
   ```

### Redis 连接失败

1. 检查服务是否运行：
   ```bash
   brew services list | grep redis
   ```

2. 检查端口是否被占用：
   ```bash
   lsof -i :6379
   ```

3. 手动启动：
   ```bash
   redis-server
   ```

### 端口冲突

如果端口 5432 或 6379 已被占用：

1. 查找占用进程：
   ```bash
   lsof -i :5432
   lsof -i :6379
   ```

2. 停止冲突服务或修改 `.env` 中的端口配置

## 推荐配置

对于开发环境，推荐使用：
- **Docker Desktop**：最简单，一键启动所有服务
- **本地安装**：如果不想用 Docker，适合长期开发
- **云服务**：如果本地资源有限，适合快速测试
