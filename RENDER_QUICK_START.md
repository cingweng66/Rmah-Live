# Render 部署快速检查清单

## ✅ 已完成的配置

- [x] `.node-version` 文件（指定 Node 20.11.0）
- [x] `render.yaml` 配置文件
- [x] `.renderignore` 文件
- [x] 更新 `backend/package.json` - 修正了 `start:prod` 脚本
- [x] 更新 `backend/Dockerfile` - 添加 NODE_ENV 设置
- [x] `.env.production` 模板文件
- [x] 数据库配置支持 SSL（已在 `database.module.ts` 中配置）

## 🚀 部署前的检查

### 1. Git 仓库检查
- [ ] 项目已推送到 GitHub/GitLab
- [ ] 包含所有文件（运行 `git status` 确保没有未跟踪的重要文件）

### 2. 数据库准备
- [ ] 在 Render 上创建 PostgreSQL 数据库，或准备外部数据库连接信息：
  - [ ] DB_HOST（例如：xxx.databases.render.com）
  - [ ] DB_PORT（通常是 5432）
  - [ ] DB_USERNAME
  - [ ] DB_PASSWORD
  - [ ] DB_DATABASE（通常 mahjong_db）

### 3. 环境变量准备
记录以下需要在 Render 中设置的环境变量：

```
NODE_ENV=production
PORT=3000
DB_HOST=<你的数据库主机>
DB_PORT=5432
DB_USERNAME=<数据库用户>
DB_PASSWORD=<数据库密码>
DB_DATABASE=mahjong_db
JWT_SECRET=<生成强密钥，运行: openssl rand -base64 32>
FRONTEND_URL=<你的前端 URL>
REDIS_HOST=<Redis 主机，或留空使用内存缓存>
REDIS_PORT=6379
REDIS_PASSWORD=<如果有>
```

### 4. 生成 JWT_SECRET

在终端运行：
```bash
openssl rand -base64 32
```
复制输出作为 JWT_SECRET

## 📋 部署步骤

### 第一次部署

1. 访问 https://dashboard.render.com
2. 点击 **New +** → **Web Service**
3. 连接你的 GitHub 仓库
4. 填写 Web Service 配置：
   - **Name**: mahjong-backend
   - **Root Directory**: `backend`
   - **Environment**: Node
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm run start:prod`
5. 添加上述所有环境变量
6. 点击 **Create Web Service**
7. 等待部署完成（通常 5-10 分钟）

### 验证部署

部署完成后，访问生成的 URL + `/health`，例如：
```
https://mahjong-backend.onrender.com/health
```

应该返回 HTTP 200 和 JSON 响应

## 🔍 常见问题排查

### 如果部署失败

1. 查看 Render 日志：
   - 在 Web Service 页面 → **Logs** 标签
   
2. 检查以下常见错误：
   - **"Cannot find module"** → `npm ci` 未正确运行
   - **"Database connection failed"** → 检查数据库环境变量
   - **"Port already in use"** → PORT 变量设置错误
   - **"Build timeout"** → 增加 Starter 计划配置或优化构建时间

### 如果数据库连接失败

1. 验证数据库连接信息是否正确
2. 检查数据库是否允许来自 Render IP 的连接
3. 对于 Render 自托管数据库，确保 Web Service 和数据库在同一地区
4. 查看 `database.module.ts` 中的 SSL 配置是否适用于你的数据库

### 如果 WebSocket 连接失败

1. 确保 FRONTEND_URL 环境变量设置正确
2. CORS 配置已在 `main.ts` 中处理多个来源

## 📱 前端配置

部署后端后，更新前端环境变量（`.env.production`）：

```env
VITE_API_URL=https://mahjong-backend.onrender.com
VITE_WS_URL=https://mahjong-backend.onrender.com
```

## 🔄 后续更新

任何代码更新推送到 GitHub 后，Render 会自动重新部署。也可以手动触发：
- Web Service 页面 → **Manual Deploy** → **Deploy latest commit**

## 💡 性能和成本

- **Starter 计划** (免费)：
  - 750 小时计算/月
  - 适合开发和小型应用
  
- **升级条件**：
  - 需要 99.9% 可用性 → Standard ($12/月+)
  - 需要更多内存 → Professional ($25/月+)

## 📚 更多帮助

- [Render 官方部署指南](RENDER_DEPLOYMENT.md)
- [Render 文档](https://render.com/docs)
- [NestJS 生产部署最佳实践](https://docs.nestjs.com/deployment/deployment)

---

**部署成功后，您的后端 API 地址为：** `https://<your-service-name>.onrender.com`
