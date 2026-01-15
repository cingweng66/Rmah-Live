#!/bin/bash

# Azure 部署脚本 - 日麻直播记分系统（使用 eastasia 区域）
# 使用方法: ./deploy-azure-eastasia.sh

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置变量
RESOURCE_GROUP="mahjong-rg"
LOCATION="eastasia"  # 固定使用 eastasia 区域

BACKEND_NAME="mahjong-backend-$(date +%s | tail -c 6)"
FRONTEND_NAME="mahjong-frontend-$(date +%s | tail -c 6)"
POSTGRES_NAME="mahjong-postgres-$(date +%s | tail -c 6)"
REDIS_NAME="mahjong-redis-$(date +%s | tail -c 6)"

# 检查 Azure CLI
if ! command -v az &> /dev/null; then
    echo_error "Azure CLI 未安装。请访问 https://aka.ms/installazurecliwindows 安装"
    exit 1
fi

# 检查登录状态
echo_info "检查 Azure 登录状态..."
if ! az account show &> /dev/null; then
    echo_warn "未登录 Azure，正在登录..."
    az login
fi

echo_info "当前订阅: $(az account show --query name -o tsv)"
echo_info "使用区域: $LOCATION (East Asia)"
echo ""

# 确认部署
read -p "是否继续部署到区域 $LOCATION？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo_info "=== 开始部署到 Azure ($LOCATION) ==="

# 1. 创建资源组
echo_info "1. 创建资源组: $RESOURCE_GROUP"
az group create --name $RESOURCE_GROUP --location $LOCATION || true

# 2. 部署 PostgreSQL
echo_info "2. 部署 PostgreSQL 数据库..."
POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
echo_warn "PostgreSQL 密码: $POSTGRES_PASSWORD (请保存)"

az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_NAME \
  --location $LOCATION \
  --admin-user postgres \
  --admin-password "$POSTGRES_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --public-access 0.0.0.0 \
  --output none

az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $POSTGRES_NAME \
  --database-name mahjong_db \
  --output none

DB_HOST=$(az postgres flexible-server show \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_NAME \
  --query fullyQualifiedDomainName -o tsv)

echo_info "PostgreSQL 已创建: $DB_HOST"

# 3. 部署 Redis（可选）
echo_info "3. 部署 Redis 缓存（可选）..."
echo_warn "注意：Redis 用于缓存 License 验证结果以提高性能。"
echo_warn "如果不部署 Redis，系统将自动使用内存缓存（单实例可用，多实例时缓存不共享）。"
read -p "是否部署 Redis 缓存？(y/n，默认 n): " -n 1 -r
echo
USE_REDIS=false
REDIS_HOST=""
REDIS_KEY=""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    USE_REDIS=true
    echo_info "创建 Redis 缓存..."
    if az redis create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$REDIS_NAME" \
      --location "$LOCATION" \
      --sku Basic \
      --vm-size c0 \
      --output none 2>/dev/null; then
        echo_info "Redis 创建成功"
        REDIS_HOST=$(az redis show \
          --resource-group "$RESOURCE_GROUP" \
          --name "$REDIS_NAME" \
          --query hostName -o tsv 2>/dev/null || echo "")

        if [ -n "$REDIS_HOST" ]; then
            REDIS_KEY=$(az redis list-keys \
              --resource-group "$RESOURCE_GROUP" \
              --name "$REDIS_NAME" \
              --query primaryKey -o tsv 2>/dev/null || echo "")
            echo_info "Redis 已创建: $REDIS_HOST"
        else
            echo_warn "无法获取 Redis 信息，将使用内存缓存"
            USE_REDIS=false
        fi
    else
        echo_error "Redis 创建失败（可能是区域限制或配额问题）"
        echo_warn "将继续部署，系统将使用内存缓存"
        USE_REDIS=false
    fi
else
    echo_info "跳过 Redis 部署，将使用内存缓存"
fi

# 4. 部署后端
echo_info "4. 部署后端 (App Service)..."
echo_info "创建 App Service Plan: ${BACKEND_NAME}-plan (Free/F1 免费层)"
echo_warn "注意：F1 免费层限制："
echo_warn "  - 每日 CPU 配额：60 分钟"
echo_warn "  - 存储：1 GB"
echo_warn "  - 不支持自定义域名和 SSL"
echo_warn "  - 不支持横向扩展（单实例）"
echo_warn "  - WebSocket 连接限制：5 个"
az appservice plan create \
  --name ${BACKEND_NAME}-plan \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku F1 \
  --is-linux \
  --output none

az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan ${BACKEND_NAME}-plan \
  --name $BACKEND_NAME \
  --runtime "NODE:20-lts" \
  --output none

# 生成 JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# 配置环境变量
echo_info "配置 Web App 环境变量..."
if [ "$USE_REDIS" = true ] && [ -n "$REDIS_HOST" ]; then
    echo_info "配置 Redis 连接信息..."
    az webapp config appsettings set \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --settings \
        NODE_ENV=production \
        PORT=3000 \
        DB_HOST="$DB_HOST" \
        DB_PORT=5432 \
        DB_USERNAME=postgres \
        DB_PASSWORD="$POSTGRES_PASSWORD" \
        DB_DATABASE=mahjong_db \
        REDIS_HOST="${REDIS_HOST}:6380" \
        REDIS_PASSWORD="$REDIS_KEY" \
        JWT_SECRET="$JWT_SECRET" \
        JWT_EXPIRES_IN=7d \
      --output none
else
    echo_info "配置环境变量（不使用 Redis）..."
    az webapp config appsettings set \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --settings \
        NODE_ENV=production \
        PORT=3000 \
        DB_HOST="$DB_HOST" \
        DB_PORT=5432 \
        DB_USERNAME=postgres \
        DB_PASSWORD="$POSTGRES_PASSWORD" \
        DB_DATABASE=mahjong_db \
        REDIS_HOST="" \
        REDIS_PASSWORD="" \
        JWT_SECRET="$JWT_SECRET" \
        JWT_EXPIRES_IN=7d \
      --output none
    echo_warn "Redis 未配置，系统将使用内存缓存"
fi

# 启用 WebSocket
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_NAME \
  --web-sockets-enabled true \
  --output none

BACKEND_URL=$(az webapp show \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_NAME \
  --query defaultHostName -o tsv)

echo_info "后端已创建: https://$BACKEND_URL"

# 5. 部署前端
echo_info "5. 部署前端 (Static Web Apps)..."

# 先创建 Static Web App
# Static Web Apps 使用 eastasia（香港）区域
echo_info "创建 Static Web App（使用 eastasia 区域）..."
az staticwebapp create \
  --name $FRONTEND_NAME \
  --resource-group $RESOURCE_GROUP \
  --location eastasia \
  --sku Free \
  --output none

# 构建前端（使用后端 URL 作为环境变量）
echo_info "构建前端（使用后端 URL: https://$BACKEND_URL）..."
cd "$(dirname "$0")"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo_info "安装前端依赖..."
    npm install
fi

# 使用环境变量构建
export VITE_API_URL="https://$BACKEND_URL"
export VITE_WS_URL="wss://$BACKEND_URL"
npm run build

# 配置环境变量（用于运行时）
az staticwebapp appsettings set \
  --name $FRONTEND_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting-names \
    VITE_API_URL=https://$BACKEND_URL \
    VITE_WS_URL=wss://$BACKEND_URL \
  --output none

# 获取前端 URL
FRONTEND_URL=$(az staticwebapp show \
  --resource-group $RESOURCE_GROUP \
  --name $FRONTEND_NAME \
  --query defaultHostname -o tsv 2>/dev/null || echo "")

if [ -n "$FRONTEND_URL" ]; then
    echo_info "前端已创建: https://$FRONTEND_URL"
else
    echo_warn "无法获取前端 URL，请稍后在 Azure Portal 中查看"
fi

# 6. 配置 CORS
echo_info "6. 配置 CORS..."
if [ -n "$FRONTEND_URL" ]; then
    az webapp cors add \
      --resource-group $RESOURCE_GROUP \
      --name $BACKEND_NAME \
      --allowed-origins "https://$FRONTEND_URL" \
      --output none
    echo_info "CORS 已配置: https://$FRONTEND_URL"
else
    echo_warn "前端 URL 未获取，请稍后手动配置 CORS"
fi

# 7. 部署后端代码
echo_info "7. 部署后端代码..."
cd backend
if [ ! -d "node_modules" ]; then
    echo_info "安装后端依赖..."
    npm install
fi
npm run build
zip -r ../backend-deploy.zip . -x "node_modules/*" -x ".git/*" -x "*.log" > /dev/null
cd ..

az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_NAME \
  --src backend-deploy.zip \
  --output none

# 清理临时文件
rm -f backend-deploy.zip

echo_info "=== 部署完成 ==="
echo ""
echo "📋 部署信息："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -n "$FRONTEND_URL" ]; then
    echo "前端 URL:     https://$FRONTEND_URL"
else
    echo "前端 URL:     请在 Azure Portal 中查看 Static Web App 的 URL"
fi
echo "后端 URL:     https://$BACKEND_URL"
echo "数据库:       $DB_HOST"
if [ "$USE_REDIS" = true ] && [ -n "$REDIS_HOST" ]; then
    echo "Redis:        $REDIS_HOST"
else
    echo "Redis:        未部署（使用内存缓存）"
fi
echo "部署区域:     $LOCATION (East Asia)"
echo ""
echo "🔐 重要信息（请保存）："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PostgreSQL 密码: $POSTGRES_PASSWORD"
echo "JWT Secret:      $JWT_SECRET"
echo ""
echo "📝 下一步："
echo "1. 访问前端 URL 测试应用"
echo "2. 在 Azure Portal 中查看资源"
echo "3. 如果前端 URL 未显示，请等待几分钟后刷新"
echo "4. 配置自定义域名（可选）"
echo "5. 设置监控和告警"
