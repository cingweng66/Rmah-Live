# Zeabur 后端部署配置（基于 Azure 现有资源）

根据您的 Azure 部署信息，以下是 Zeabur 后端服务需要的环境变量配置。

## 📋 Azure 资源信息

根据脚本文件中的信息，您的 Azure 资源如下：

### 数据库信息
- **资源组**: `mahjong-live`
- **PostgreSQL 服务器名**: `mahjong-postgres-50831`
- **数据库主机**: `mahjong-postgres-50831.postgres.database.azure.com`（推测）
- **数据库用户名**: `postgres`
- **数据库密码**: `4I6RJOUWy5m8W2Uh`（从 test-db-direct.sh 中找到）
- **数据库名称**: `mahjong_db`
- **数据库端口**: `5432`

### 后端服务信息
- **资源组**: `mahjong-live`
- **Container App 名称**: `mahjong-backend-53114`
- **后端 URL**: 需要从 Azure Portal 或运行 `az containerapp show` 获取

### 前端服务信息
- **资源组**: `mahjong-live`
- **前端 URL**: 需要从 Azure Portal 或 Storage Account 获取

## 🔧 Zeabur 后端环境变量配置

在 Zeabur 中部署后端服务时，请设置以下环境变量：

### 必需环境变量

```bash
# 基础配置
NODE_ENV=production
PORT=3000  # TCP 端口，应用层使用 HTTP/HTTPS 协议

# 数据库配置（Azure PostgreSQL）
DB_HOST=mahjong-postgres-50831.postgres.database.azure.com
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=SQzyzxlzh2002%%
DB_DATABASE=mahjong_db

# JWT 配置（必须生成新的强密钥）
JWT_SECRET=kUDiwcz+790WYQhWH6utZzh2vD3e+7HpH5i87QPLbI0=
JWT_EXPIRES_IN=7d

# 前端地址（用于 CORS，需要包含 https:// 协议）
FRONTEND_URL=https://mahjongweb8473433.z28.web.core.windows.net
如果不使用 Redis，可以不设置这些变量，系统会自动使用内存缓存。

## 🔑 生成 JWT_SECRET

**重要**：请为 Zeabur 部署生成一个新的 JWT_SECRET，不要使用 Azure 上的密钥。
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"


```bash
# 使用 openssl 生成
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 📝 获取实际配置信息

由于无法直接运行 Azure CLI，请按以下步骤获取实际配置：

### 1. 获取数据库主机地址

在本地运行（需要 Azure CLI 和登录）：

```bash
az postgres flexible-server show \
  --resource-group mahjong-live \
  --name mahjong-postgres-50831 \
  --query fullyQualifiedDomainName -o tsv
```

或者登录 Azure Portal：
1. 进入资源组 `mahjong-live`
2. 找到 PostgreSQL 服务器 `mahjong-postgres-50831`
3. 在"概览"页面查看"服务器名称"（FQDN）

### 2. 获取前端 URL

**如果是 Azure Static Web Apps：**
```bash
az staticwebapp show \
  --resource-group mahjong-live \
  --name <你的前端应用名称> \
  --query defaultHostname -o tsv
```

**如果是 Azure Storage Static Website：**
```bash
az storage account show \
  --resource-group mahjong-live \
  --name <你的存储账户名称> \
  --query "primaryEndpoints.web" -o tsv
```

或者在 Azure Portal 中：
1. 进入资源组 `mahjong-live`
2. 找到 Static Web App 或 Storage Account
3. 查看 URL

### 3. 获取后端 URL（如果需要）

```bash
az containerapp show \
  --resource-group mahjong-live \
  --name mahjong-backend-53114 \
  --query "properties.configuration.ingress.fqdn" -o tsv
```

## ✅ 配置检查清单

在 Zeabur 中配置环境变量前，请确认：

- [ ] `DB_HOST` - 已从 Azure Portal 或 CLI 获取正确的数据库主机地址
- [ ] `DB_PASSWORD` - 使用 `4I6RJOUWy5m8W2Uh`（或确认这是正确的密码）
- [ ] `JWT_SECRET` - 已生成新的强密钥
- [ ] `FRONTEND_URL` - 已获取并设置为正确的前端地址（包含 `https://`）
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`（Zeabur 通常会自动设置，但可以显式设置）

## 🔒 安全注意事项

1. **数据库密码**：确认 `4I6RJOUWy5m8W2Uh` 是正确的密码。如果不确定，可以在 Azure Portal 中重置密码。

2. **防火墙规则**：Azure PostgreSQL 可能需要配置防火墙规则以允许 Zeabur 的 IP 地址访问。请在 Azure Portal 中：
   - 进入 PostgreSQL 服务器
   - 打开"网络"设置
   - 添加防火墙规则允许 Zeabur 的 IP（或临时允许所有 IP `0.0.0.0` 进行测试）

3. **SSL 连接**：代码已自动处理 Azure PostgreSQL 的 SSL 连接，无需额外配置。

## 📡 关于端口和协议

**PORT 3000 说明**：
- **传输层**：使用 **TCP 协议**（所有 HTTP/WebSocket 都基于 TCP）
- **应用层**：使用 **HTTP/HTTPS 协议**（REST API）
- **WebSocket**：使用 **WS/WSS 协议**（也基于 TCP）

在 Zeabur 中：
- 只需要设置 `PORT=3000`（端口号）
- Zeabur 会自动处理 HTTP/HTTPS 协议
- 不需要指定 `tcp://` 或 `http://` 前缀
- Zeabur 会自动提供 HTTPS 和 WebSocket (WSS) 支持

## 🚀 部署步骤

1. **在 Zeabur 中创建后端服务**
   - 从 Docker 镜像或 GitHub 仓库部署
   - 选择端口：3000（Zeabur 会自动映射）

2. **设置环境变量**
   - 按照上述配置添加所有必需的环境变量
   - **注意**：`PORT=3000` 只是端口号，不需要指定协议类型

3. **配置端口映射**（如果需要）
   - Zeabur 通常会自动检测 Dockerfile 中的 `EXPOSE 3000`
   - 如果未自动检测，在 Zeabur 服务设置中指定端口 3000

4. **测试连接**
   - 部署后检查日志，确认数据库连接成功
   - 测试 API 端点是否正常（使用 HTTPS）

5. **更新前端配置**（如果需要）
   - 如果前端需要指向新的 Zeabur 后端，更新前端的 `VITE_API_URL` 和 `VITE_WS_URL`
   - 使用 `https://` 和 `wss://` 协议

## 📞 需要帮助？

如果遇到问题：

1. **数据库连接失败**
   - 检查防火墙规则
   - 确认数据库密码正确
   - 检查数据库主机地址是否正确

2. **CORS 错误**
   - 确认 `FRONTEND_URL` 设置正确
   - 检查前端地址是否包含协议（`https://`）

3. **WebSocket 连接失败**
   - 确认使用 `wss://` 协议（如果使用 HTTPS）
   - 检查 Zeabur 是否支持 WebSocket
