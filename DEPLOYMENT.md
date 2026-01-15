# 部署指南

本文档说明如何在本地和 VPS 上部署日麻直播记分系统。

## 系统要求

- Node.js 20+
- Docker & Docker Compose（推荐）
- PostgreSQL 15+（如果不用 Docker）
- Redis 7+（如果不用 Docker）

## 本地部署

### 1. 后端部署

#### 方式 A：使用 Docker Compose（推荐）

```bash
cd backend

# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，修改配置（可选）
# 默认配置已适合本地开发

# 启动所有服务（数据库、Redis、后端）
# macOS 新版本: docker compose up -d
# 旧版本: docker-compose up -d
docker compose up -d

# 查看日志
docker compose logs -f backend
# 或: docker-compose logs -f backend

# 停止服务
docker compose down
# 或: docker-compose down
```

#### 方式 B：本地运行

**步骤 1：安装 PostgreSQL 和 Redis**

- macOS: `brew install postgresql redis`
- Ubuntu: `sudo apt-get install postgresql redis-server`
- Windows: 下载安装包

**步骤 2：创建数据库**

```bash
# 连接到 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE mahjong_db;

# 退出
\q
```

**步骤 3：启动 Redis**

```bash
redis-server
```

**步骤 4：配置和启动后端**

```bash
cd backend

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 编辑 .env，确保数据库和 Redis 配置正确

# 启动开发服务器
npm run start:dev
```

### 2. 前端部署

```bash
# 在项目根目录

# 安装依赖
npm install

# 创建环境变量文件
echo "VITE_API_URL=http://localhost:3000" > .env
echo "VITE_WS_URL=http://localhost:3000" >> .env

# 启动开发服务器
npm run dev
```

前端将在 `http://localhost:8080` 运行。

### 3. 测试部署

1. 打开浏览器访问 `http://localhost:8080`
2. 注册新账户
3. 激活 License Key（首次注册后）
4. 登录并测试功能

## VPS 部署

### 准备工作

1. **购买 VPS**（推荐配置）：
   - CPU: 2 核
   - 内存: 4GB
   - 存储: 20GB SSD
   - 操作系统: Ubuntu 22.04 LTS

2. **连接到 VPS**

```bash
ssh root@your-vps-ip
```

### 安装 Docker 和 Docker Compose

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 安装 Docker Compose
apt install docker-compose -y

# 验证安装
docker --version
docker-compose --version
```

### 部署后端

```bash
# 克隆项目（或上传文件）
git clone <your-repo-url>
cd 日麻直播记分系统\ \(1\)/backend

# 创建环境变量文件
cp .env.example .env

# 编辑 .env 文件
nano .env
```

**重要配置项：**

```env
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
JWT_SECRET=your-very-strong-random-secret-key-here
DB_PASSWORD=your-strong-database-password
REDIS_PASSWORD=your-strong-redis-password
```

**启动服务：**

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 检查服务状态
docker-compose ps
```

### 部署前端

#### 方式 A：使用 Nginx 静态文件服务

```bash
# 在本地构建前端
npm run build

# 上传 dist 目录到 VPS
scp -r dist root@your-vps-ip:/var/www/mahjong-frontend

# 在 VPS 上安装 Nginx
apt install nginx -y

# 配置 Nginx
nano /etc/nginx/sites-available/mahjong
```

**Nginx 配置：**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/mahjong-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 代理后端 API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # 代理 WebSocket
    location /game {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**启用配置：**

```bash
ln -s /etc/nginx/sites-available/mahjong /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

#### 方式 B：使用 Docker 部署前端

创建 `docker-compose.frontend.yml`：

```yaml
version: '3.8'

services:
  frontend:
    image: nginx:alpine
    container_name: mahjong-frontend
    ports:
      - "80:80"
    volumes:
      - ./dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    restart: unless-stopped
```

### 配置 HTTPS（使用 Let's Encrypt）

```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx -y

# 获取 SSL 证书
certbot --nginx -d your-domain.com

# 自动续期
certbot renew --dry-run
```

### 配置防火墙

```bash
# 允许 HTTP 和 HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# 允许 SSH（重要！）
ufw allow 22/tcp

# 启用防火墙
ufw enable
```

### 更新环境变量

修改前端的 `.env` 文件：

```env
VITE_API_URL=https://your-domain.com
VITE_WS_URL=https://your-domain.com
```

重新构建前端：

```bash
npm run build
```

## 维护和监控

### 查看日志

```bash
# 后端日志
docker-compose logs -f backend

# 数据库日志
docker-compose logs -f postgres

# Redis 日志
docker-compose logs -f redis
```

### 备份数据库

```bash
# 创建备份
docker-compose exec postgres pg_dump -U postgres mahjong_db > backup.sql

# 恢复备份
docker-compose exec -T postgres psql -U postgres mahjong_db < backup.sql
```

### 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建和启动
docker-compose up -d --build
```

### 监控资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
df -h
```

## 故障排查

### 后端无法启动

1. 检查日志：`docker-compose logs backend`
2. 检查数据库连接：`docker-compose exec backend npm run typeorm migration:run`
3. 检查端口占用：`netstat -tulpn | grep 3000`

### WebSocket 连接失败

1. 检查 CORS 配置
2. 检查 Nginx 配置中的 WebSocket 代理
3. 检查防火墙设置

### 数据库连接失败

1. 检查数据库服务：`docker-compose ps postgres`
2. 检查连接信息：`.env` 文件
3. 测试连接：`docker-compose exec postgres psql -U postgres -d mahjong_db`

## 安全建议

1. **更改默认密码**：数据库、Redis、JWT Secret
2. **使用 HTTPS**：生产环境必须
3. **定期更新**：系统和依赖包
4. **备份数据**：定期备份数据库
5. **监控日志**：设置日志监控和告警

## 性能优化

1. **启用 Redis 缓存**：已配置
2. **数据库索引**：TypeORM 自动创建
3. **CDN**：静态资源使用 CDN
4. **负载均衡**：多实例部署时使用

## 支持

如有问题，请查看：
- 后端 README: `backend/README.md`
- 日志文件
- GitHub Issues
