# Render 部署指南

本文档说明如何部署此 NestJS 应用到 Render.

## 前置条件

1. **Render 账户**：https://render.com
2. **PostgreSQL 数据库**：
   - 在 Render 上创建 PostgreSQL 数据库，或使用外部数据库
   - 或在本地/其他地方运行的 PostgreSQL
3. **Git 仓库**：项目需要推送到 GitHub/GitLab

## 部署步骤

### 步骤 1：准备 Git 仓库

确保项目已推送到 GitHub：

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 步骤 2：在 Render 上创建 PostgreSQL 数据库（可选）

如果还没有数据库：

1. 登录 Render Dashboard：https://dashboard.render.com
2. 点击 **New +** → **PostgreSQL**
3. 填写信息：
   - Name: `mahjong-db`
   - Database: `mahjong_db`
   - User: `mahjong_user`
   - Region: 选择离用户最近的地区
4. 点击 **Create Database**
5. 保存显示的连接信息（Host、Port、User、Password）

### 步骤 3：创建 Web Service

1. 在 Render Dashboard，点击 **New +** → **Web Service**
2. 选择 **Connect a repository**，选择本项目
3. 填写配置信息：
   - **Name**: `mahjong-backend`（或自定义）
   - **Root Directory**: `backend`（重要！）
   - **Environment**: `Node`
   - **Region**: 选择与数据库相同的地区
   - **Branch**: `main`（或您的分支）
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Plan**: 选择 Starter 或更高版本

4. 在 **Environment** 部分添加环境变量：

   ```
   NODE_ENV=production
   PORT=3000
   DB_HOST=<你的数据库主机>
   DB_PORT=5432
   DB_USERNAME=<数据库用户>
   DB_PASSWORD=<数据库密码>
   DB_DATABASE=mahjong_db
   JWT_SECRET=<生成一个强密钥，例如: openssl rand -base64 32>
   FRONTEND_URL=<你的前端 URL，例如 https://your-frontend.onrender.com>
   REDIS_HOST=<如果使用 Redis，填入地址；否则留空>
   REDIS_PORT=6379
   REDIS_PASSWORD=<Redis 密码，如果有>
   ```

5. 点击 **Create Web Service**

### 步骤 4：等待部署完成

Render 会自动：
1. 拉取您的代码
2. 安装依赖
3. 构建应用
4. 启动服务

您可以在仪表板看到部署日志。部署通常需要 5-10 分钟。

### 步骤 5：验证部署

部署完成后，会分配一个 URL，例如：
- `https://mahjong-backend.onrender.com`

测试应用：

```bash
# 测试健康检查端点
curl https://mahjong-backend.onrender.com/health

# 如果返回 200 和 JSON 响应，说明部署成功
```

### 步骤 6：更新前端配置

在前端项目中更新 API URL：

```bash
# .env 或 .env.production
VITE_API_URL=https://mahjong-backend.onrender.com
VITE_WS_URL=https://mahjong-backend.onrender.com
```

## 常见问题

### 问题 1：构建失败 - 找不到 backend 目录

**解决方案**：
- 确保在 Web Service 配置中设置 **Root Directory** 为 `backend`

### 问题 2：应用启动失败 - 数据库连接错误

**解决方案**：
1. 检查环境变量是否正确设置
2. 确保数据库用户有权创建表
3. 检查数据库是否处于运行状态
4. 查看 Render 日志获取详细错误

### 问题 3：应用崩溃 - "缺少依赖"

**解决方案**：
- 检查 `package.json` 中的所有依赖是否正确
- 运行 `npm ci` 确保锁定文件匹配

### 问题 4：WebSocket 连接失败

**解决方案**：
- 确保 FRONTEND_URL 正确设置
- 在 Web Service 设置中启用 WebSocket 支持

## 后续管理

### 查看日志

在 Render Dashboard 中：
1. 选择您的 Web Service
2. 点击 **Logs** 标签
3. 实时查看日志输出

### 重新部署

任何代码更新推送到 GitHub 后，Render 会自动重新部署。

或手动重新部署：
1. 在 Service 页面
2. 点击右上角 **Manual Deploy** → **Deploy latest commit**

### 监控

使用 Render 提供的监控工具：
- CPU 和内存使用率
- 请求数量
- 响应时间

## 性能优化建议

1. **使用 PostgreSQL 连接池**：配置 `pgBouncer`
2. **启用 Redis 缓存**：减少数据库查询
3. **设置更高的内存**：对于高并发应用
4. **使用 CDN**：加速静态资源

## 成本优化

- **Starter 计划**：免费 (每月 750 小时免费计算)
- **Standard 计划**：$12/月起
- 数据库有单独的定价

## 更多资源

- [Render 官方文档](https://render.com/docs)
- [NestJS 部署指南](https://docs.nestjs.com/deployment/deployment)
- [PostgreSQL 连接字符串](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
