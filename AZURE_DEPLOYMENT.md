# Azure 部署指南

本文档说明如何将日麻直播记分系统部署到 Azure 云平台。

## ⚠️ 重要：区域选择

Azure 订阅可能有区域限制。在部署前，请先检查您的订阅允许的区域：

```bash
# 运行区域检查脚本
./check-azure-regions.sh

# 或手动检查
az account list-locations --query "[?metadata.regionCategory=='Recommended'].{Name:name, DisplayName:displayName}" -o table
```

**常见可用区域**（根据您的订阅可能不同）：
- `eastus` - 美国东部（最常用）
- `westus2` - 美国西部 2
- `westeurope` - 西欧
- `southeastasia` - 东南亚
- `japaneast` - 日本东部
- `koreacentral` - 韩国中部

如果遇到区域限制错误，请：
1. 运行 `./check-azure-regions.sh` 查看允许的区域
2. 在部署脚本中选择一个允许的区域
3. 或手动指定区域（见下方说明）

---

## 架构选择

### 推荐方案：混合部署（最佳性价比）

- **前端**：Azure Static Web Apps（免费层可用，自动HTTPS）
- **后端**：Azure App Service (Node.js) 或 Azure Container Apps
- **数据库**：Azure Database for PostgreSQL（托管服务）
- **缓存**：Azure Cache for Redis（托管服务）

### 备选方案：全容器部署

- **前端 + 后端**：Azure Container Apps（使用 Docker Compose）
- **数据库**：Azure Database for PostgreSQL
- **缓存**：Azure Cache for Redis

---

## 方案一：Azure Static Web Apps + App Service（推荐）

### 前置准备

1. 安装 Azure CLI
```bash
# macOS
brew install azure-cli

# 或访问 https://aka.ms/installazurecliwindows
```

2. 登录 Azure
```bash
az login
```

3. 创建资源组

**重要**：请先运行 `./check-azure-regions.sh` 查看您的订阅允许的区域，然后选择合适的区域。

```bash
# 检查可用区域
./check-azure-regions.sh

# 创建资源组（请替换 eastus 为您选择的区域）
az group create --name mahjong-rg --location eastus
```

### 步骤 1：部署数据库（Azure Database for PostgreSQL）

```bash
# 创建 PostgreSQL 服务器（请替换 location 为您的可用区域）
az postgres flexible-server create \
  --resource-group mahjong-rg \
  --name mahjong-postgres \
  --location eastus \
  --admin-user postgres \
  --admin-password "YourStrongPassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --public-access 0.0.0.0

# 创建数据库
az postgres flexible-server db create \
  --resource-group mahjong-rg \
  --server-name mahjong-postgres \
  --database-name mahjong_db

# 获取连接字符串（稍后使用）
az postgres flexible-server show-connection-string \
  --server-name mahjong-postgres \
  --admin-user postgres \
  --admin-password "YourStrongPassword123!" \
  --database-name mahjong_db
```

### 步骤 2：部署 Redis 缓存

```bash
# 创建 Redis 缓存（请替换 location 为您的可用区域）
az redis create \
  --resource-group mahjong-rg \
  --name mahjong-redis \
  --location eastus \
  --sku Basic \
  --vm-size c0

# 获取 Redis 连接信息
az redis show \
  --resource-group mahjong-rg \
  --name mahjong-redis \
  --query "{hostName:hostName,sslPort:port,accessKeys:accessKeys}" \
  --output json
```

### 步骤 3：部署后端（Azure App Service）

#### 方式 A：使用 Node.js 运行时（推荐）

```bash
# 创建 App Service 计划（请替换 location 为您的可用区域）
az appservice plan create \
  --name mahjong-backend-plan \
  --resource-group mahjong-rg \
  --location eastus \
  --sku B1 \
  --is-linux

# 创建 Web App
az webapp create \
  --resource-group mahjong-rg \
  --plan mahjong-backend-plan \
  --name mahjong-backend \
  --runtime "NODE:20-lts"

# 配置环境变量
az webapp config appsettings set \
  --resource-group mahjong-rg \
  --name mahjong-backend \
  --settings \
    NODE_ENV=production \
    PORT=3000 \
    FRONTEND_URL=https://your-frontend-url.azurestaticapps.net \
    DB_HOST=your-postgres-host.postgres.database.azure.com \
    DB_PORT=5432 \
    DB_USERNAME=postgres \
    DB_PASSWORD="YourStrongPassword123!" \
    DB_DATABASE=mahjong_db \
    REDIS_HOST=your-redis-host.redis.cache.windows.net \
    REDIS_PORT=6380 \
    REDIS_PASSWORD="your-redis-access-key" \
    JWT_SECRET="your-very-strong-jwt-secret-key" \
    JWT_EXPIRES_IN=7d

# 部署代码（从本地）
cd backend
zip -r ../backend.zip .
az webapp deployment source config-zip \
  --resource-group mahjong-rg \
  --name mahjong-backend \
  --src ../backend.zip
```

#### 方式 B：使用 Docker 容器

```bash
# 创建 Azure Container Registry（可选，用于存储镜像）
az acr create \
  --resource-group mahjong-rg \
  --name mahjongregistry \
  --sku Basic

# 登录到 ACR
az acr login --name mahjongregistry

# 构建并推送镜像
cd backend
az acr build --registry mahjongregistry --image mahjong-backend:latest .

# 创建 App Service 并部署容器
az webapp create \
  --resource-group mahjong-rg \
  --plan mahjong-backend-plan \
  --name mahjong-backend \
  --deployment-container-image-name mahjongregistry.azurecr.io/mahjong-backend:latest

# 配置环境变量（同上）
az webapp config appsettings set \
  --resource-group mahjong-rg \
  --name mahjong-backend \
  --settings \
    NODE_ENV=production \
    PORT=3000 \
    # ... 其他环境变量
```

### 步骤 4：部署前端（Azure Static Web Apps）

```bash
# 安装 Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# 在项目根目录创建配置文件
cat > staticwebapp.config.json << 'EOF'
{
  "routes": [
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ],
  "navigationFallback": {
    "fallback": "/index.html"
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html",
      "statusCode": 200
    }
  }
}
EOF

# 构建前端
npm run build

# 创建 Static Web App（请替换 location 为您的可用区域）
az staticwebapp create \
  --name mahjong-frontend \
  --resource-group mahjong-rg \
  --location eastus \
  --sku Free

# 部署前端（使用 GitHub Actions 或手动部署）
# 方式 1：手动部署
az staticwebapp appsettings set \
  --name mahjong-frontend \
  --resource-group mahjong-rg \
  --setting-names \
    VITE_API_URL=https://mahjong-backend.azurewebsites.net \
    VITE_WS_URL=wss://mahjong-backend.azurewebsites.net

# 方式 2：使用 GitHub Actions（推荐）
# 在 GitHub 仓库中，Azure 会自动创建 GitHub Actions workflow
# 每次 push 到 main 分支会自动部署
```

### 步骤 5：配置 CORS 和 WebSocket

在后端 App Service 中配置：

```bash
# 允许前端域名访问
az webapp cors add \
  --resource-group mahjong-rg \
  --name mahjong-backend \
  --allowed-origins "https://your-frontend-url.azurestaticapps.net"
```

---

## 方案二：Azure Container Apps（全容器部署）

### 前置准备

```bash
# 安装 Container Apps 扩展
az extension add --name containerapp

# 注册 Container Apps 命名空间
az provider register --namespace Microsoft.App
```

### 步骤 1：创建 Container Apps 环境

```bash
# 创建 Log Analytics 工作区
az monitor log-analytics workspace create \
  --resource-group mahjong-rg \
  --workspace-name mahjong-logs

# 获取工作区 ID 和共享密钥
LOG_ANALYTICS_WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group mahjong-rg \
  --workspace-name mahjong-logs \
  --query customerId -o tsv)

LOG_ANALYTICS_WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group mahjong-rg \
  --workspace-name mahjong-logs \
  --query primarySharedKey -o tsv)

# 创建 Container Apps 环境（请替换 location 为您的可用区域）
az containerapp env create \
  --name mahjong-env \
  --resource-group mahjong-rg \
  --location eastus \
  --logs-workspace-id $LOG_ANALYTICS_WORKSPACE_ID \
  --logs-workspace-key $LOG_ANALYTICS_WORKSPACE_KEY
```

### 步骤 2：构建并推送 Docker 镜像

```bash
# 创建 Azure Container Registry
az acr create \
  --resource-group mahjong-rg \
  --name mahjongregistry \
  --sku Basic \
  --admin-enabled true

# 登录到 ACR
az acr login --name mahjongregistry

# 构建后端镜像
cd backend
az acr build --registry mahjongregistry --image mahjong-backend:latest .

# 构建前端镜像（需要先创建前端 Dockerfile）
cd ..
# 创建前端 Dockerfile（见下方）
az acr build --registry mahjongregistry --image mahjong-frontend:latest .
```

### 步骤 3：创建前端 Dockerfile

```dockerfile
# 前端 Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
RUN npm ci

# 复制源代码
COPY . .

# 构建
RUN npm run build

# 生产环境镜像
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

创建 `nginx.conf`：

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 代理后端 API
    location /api {
        proxy_pass http://mahjong-backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 代理 WebSocket
    location /game {
        proxy_pass http://mahjong-backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 步骤 4：部署后端容器应用

```bash
# 获取 ACR 登录服务器
ACR_LOGIN_SERVER=$(az acr show --name mahjongregistry --resource-group mahjong-rg --query loginServer -o tsv)

# 创建后端容器应用
az containerapp create \
  --name mahjong-backend \
  --resource-group mahjong-rg \
  --environment mahjong-env \
  --image $ACR_LOGIN_SERVER/mahjong-backend:latest \
  --target-port 3000 \
  --ingress external \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $(az acr credential show --name mahjongregistry --query username -o tsv) \
  --registry-password $(az acr credential show --name mahjongregistry --query passwords[0].value -o tsv) \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    DB_HOST=your-postgres-host.postgres.database.azure.com \
    DB_PORT=5432 \
    DB_USERNAME=postgres \
    DB_PASSWORD="YourStrongPassword123!" \
    DB_DATABASE=mahjong_db \
    REDIS_HOST=your-redis-host.redis.cache.windows.net \
    REDIS_PORT=6380 \
    REDIS_PASSWORD="your-redis-access-key" \
    JWT_SECRET="your-very-strong-jwt-secret-key" \
    JWT_EXPIRES_IN=7d \
    FRONTEND_URL=https://mahjong-frontend.azurecontainerapps.io
```

### 步骤 5：部署前端容器应用

```bash
# 创建前端容器应用
az containerapp create \
  --name mahjong-frontend \
  --resource-group mahjong-rg \
  --environment mahjong-env \
  --image $ACR_LOGIN_SERVER/mahjong-frontend:latest \
  --target-port 80 \
  --ingress external \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $(az acr credential show --name mahjongregistry --query username -o tsv) \
  --registry-password $(az acr credential show --name mahjongregistry --query passwords[0].value -o tsv) \
  --env-vars \
    VITE_API_URL=https://mahjong-backend.azurecontainerapps.io \
    VITE_WS_URL=wss://mahjong-backend.azurecontainerapps.io
```

---

## 快速部署脚本

### 创建部署脚本 `deploy-azure.sh`

```bash
#!/bin/bash

# Azure 部署脚本
set -e

RESOURCE_GROUP="mahjong-rg"
LOCATION="eastasia"
BACKEND_NAME="mahjong-backend"
FRONTEND_NAME="mahjong-frontend"
POSTGRES_NAME="mahjong-postgres"
REDIS_NAME="mahjong-redis"

echo "=== 创建资源组 ==="
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "=== 部署 PostgreSQL ==="
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_NAME \
  --location $LOCATION \
  --admin-user postgres \
  --admin-password "ChangeThisPassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --public-access 0.0.0.0

az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $POSTGRES_NAME \
  --database-name mahjong_db

echo "=== 部署 Redis ==="
az redis create \
  --resource-group $RESOURCE_GROUP \
  --name $REDIS_NAME \
  --location $LOCATION \
  --sku Basic \
  --vm-size c0

echo "=== 部署后端 ==="
az appservice plan create \
  --name ${BACKEND_NAME}-plan \
  --resource-group $RESOURCE_GROUP \
  --sku B1 \
  --is-linux

az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan ${BACKEND_NAME}-plan \
  --name $BACKEND_NAME \
  --runtime "NODE:20-lts"

# 获取数据库和 Redis 连接信息
DB_HOST=$(az postgres flexible-server show \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_NAME \
  --query fullyQualifiedDomainName -o tsv)

REDIS_HOST=$(az redis show \
  --resource-group $RESOURCE_GROUP \
  --name $REDIS_NAME \
  --query hostName -o tsv)

REDIS_KEY=$(az redis list-keys \
  --resource-group $RESOURCE_GROUP \
  --name $REDIS_NAME \
  --query primaryKey -o tsv)

az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_NAME \
  --settings \
    NODE_ENV=production \
    PORT=3000 \
    DB_HOST=$DB_HOST \
    DB_PORT=5432 \
    DB_USERNAME=postgres \
    DB_PASSWORD="ChangeThisPassword123!" \
    DB_DATABASE=mahjong_db \
    REDIS_HOST=${REDIS_HOST}:6380 \
    REDIS_PASSWORD="$REDIS_KEY" \
    JWT_SECRET="$(openssl rand -base64 32)" \
    JWT_EXPIRES_IN=7d

echo "=== 部署前端 ==="
az staticwebapp create \
  --name $FRONTEND_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Free

BACKEND_URL=$(az webapp show \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_NAME \
  --query defaultHostName -o tsv)

az staticwebapp appsettings set \
  --name $FRONTEND_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting-names \
    VITE_API_URL=https://$BACKEND_URL \
    VITE_WS_URL=wss://$BACKEND_URL

echo "=== 部署完成 ==="
echo "后端 URL: https://$BACKEND_URL"
echo "前端 URL: 请在 Azure Portal 中查看 Static Web App 的 URL"
```

---

## 打包和上传步骤

### 方式 1：使用 Azure CLI 直接部署（Node.js）

```bash
# 1. 构建后端
cd backend
npm install
npm run build

# 2. 打包
zip -r ../backend-deploy.zip . -x "node_modules/*" -x ".git/*"

# 3. 部署到 Azure App Service
az webapp deployment source config-zip \
  --resource-group mahjong-rg \
  --name mahjong-backend \
  --src ../backend-deploy.zip
```

### 方式 2：使用 Docker 和 Azure Container Registry

```bash
# 1. 构建后端镜像
cd backend
docker build -t mahjong-backend:latest .

# 2. 登录到 ACR
az acr login --name mahjongregistry

# 3. 标记镜像
docker tag mahjong-backend:latest mahjongregistry.azurecr.io/mahjong-backend:latest

# 4. 推送镜像
docker push mahjongregistry.azurecr.io/mahjong-backend:latest

# 5. 更新容器应用
az containerapp update \
  --name mahjong-backend \
  --resource-group mahjong-rg \
  --image mahjongregistry.azurecr.io/mahjong-backend:latest
```

### 方式 3：使用 GitHub Actions（推荐，自动化）

创建 `.github/workflows/azure-deploy.yml`：

```yaml
name: Deploy to Azure

on:
  push:
    branches: [ main ]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Build
        run: |
          cd backend
          npm run build
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: 'mahjong-backend'
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: ./backend

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_WS_URL: ${{ secrets.VITE_WS_URL }}
      
      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          output_location: "dist"
```

---

## 成本估算

### 方案一（推荐）
- **Static Web Apps (Free)**：$0/月
- **App Service (B1)**：~$13/月
- **PostgreSQL (Basic)**：~$25/月
- **Redis (Basic C0)**：~$15/月
- **总计**：~$53/月

### 方案二（容器）
- **Container Apps**：按使用量计费，约 $20-40/月
- **PostgreSQL**：~$25/月
- **Redis**：~$15/月
- **Container Registry**：~$5/月
- **总计**：~$65-85/月

---

## 推荐选择

**对于您的项目，我推荐方案一（Static Web Apps + App Service）**：

1. ✅ **前端使用 Static Web Apps**：
   - 免费层可用
   - 自动 HTTPS
   - 全球 CDN
   - 自动部署（GitHub Actions）

2. ✅ **后端使用 App Service (Node.js)**：
   - 简单易用
   - 内置 Node.js 运行时
   - 自动扩缩容
   - 支持 WebSocket

3. ✅ **数据库和缓存使用托管服务**：
   - 无需维护
   - 自动备份
   - 高可用性

---

## 下一步

1. 运行部署脚本或手动执行上述步骤
2. 配置自定义域名（可选）
3. 设置监控和告警
4. 配置自动备份

需要我帮您创建具体的部署脚本吗？
