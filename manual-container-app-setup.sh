#!/bin/bash

# 手动完成 Container App 创建的脚本
# 用于在 SSL 证书错误时手动完成部署

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo_info "=== 手动完成 Container App 部署 ==="
echo ""
echo_warn "此脚本用于在 SSL 证书错误时手动完成 Container App 的创建"
echo ""

# 读取已创建的资源信息
read -p "请输入资源组名称 (默认: mahjong-live): " RESOURCE_GROUP
RESOURCE_GROUP=${RESOURCE_GROUP:-mahjong-live}

read -p "请输入 Container App 名称 (例如: mahjong-backend-53114): " BACKEND_NAME
if [ -z "$BACKEND_NAME" ]; then
    echo_error "Container App 名称不能为空"
    exit 1
fi

read -p "请输入 Container Apps Environment 名称 (例如: mahjong-env-53114): " CONTAINER_ENV_NAME
if [ -z "$CONTAINER_ENV_NAME" ]; then
    echo_error "Environment 名称不能为空"
    exit 1
fi

read -p "请输入 ACR 登录服务器 (例如: mahjongacr53114.azurecr.io): " ACR_LOGIN_SERVER
if [ -z "$ACR_LOGIN_SERVER" ]; then
    echo_error "ACR 登录服务器不能为空"
    exit 1
fi

read -p "请输入镜像名称 (例如: mahjongacr53114.azurecr.io/mahjong-backend-53114:latest): " IMAGE_NAME
if [ -z "$IMAGE_NAME" ]; then
    echo_error "镜像名称不能为空"
    exit 1
fi

# 获取 ACR 凭据
echo_info "获取 ACR 凭据..."
ACR_USERNAME=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "${ACR_LOGIN_SERVER%%.*}" \
  --query username -o tsv)

ACR_PASSWORD=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "${ACR_LOGIN_SERVER%%.*}" \
  --query passwords[0].value -o tsv)

# 获取数据库信息
echo_info "获取数据库信息..."
DB_HOST=$(az postgres flexible-server list \
  --resource-group "$RESOURCE_GROUP" \
  --query "[0].fullyQualifiedDomainName" -o tsv)

read -sp "请输入 PostgreSQL 密码: " POSTGRES_PASSWORD
echo

# 生成 JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# 准备环境变量
read -p "是否使用 Redis？(y/n，默认 n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    REDIS_HOST=$(az redis list \
      --resource-group "$RESOURCE_GROUP" \
      --query "[0].hostName" -o tsv)
    REDIS_KEY=$(az redis list-keys \
      --resource-group "$RESOURCE_GROUP" \
      --name "${REDIS_HOST%%.*}" \
      --query primaryKey -o tsv)
    ENV_VARS="NODE_ENV=production PORT=3000 DB_HOST=$DB_HOST DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=$POSTGRES_PASSWORD DB_DATABASE=mahjong_db REDIS_HOST=${REDIS_HOST}:6380 REDIS_PASSWORD=$REDIS_KEY JWT_SECRET=$JWT_SECRET JWT_EXPIRES_IN=7d FRONTEND_URL=https://placeholder.frontend.url"
else
    ENV_VARS="NODE_ENV=production PORT=3000 DB_HOST=$DB_HOST DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=$POSTGRES_PASSWORD DB_DATABASE=mahjong_db REDIS_HOST= REDIS_PASSWORD= JWT_SECRET=$JWT_SECRET JWT_EXPIRES_IN=7d FRONTEND_URL=https://placeholder.frontend.url"
fi

# 临时禁用 SSL 验证
export AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1

echo_info "创建 Container App（使用临时 SSL 验证禁用）..."
az containerapp create \
  --name "$BACKEND_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_ENV_NAME" \
  --image "$IMAGE_NAME" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars $ENV_VARS \
  --output none

# 恢复 SSL 验证
unset AZURE_CLI_DISABLE_CONNECTION_VERIFICATION

# 获取 URL
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query properties.configuration.ingress.fqdn -o tsv)

echo_info "=== Container App 创建完成 ==="
echo ""
echo "📋 部署信息："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "后端 URL:     https://$BACKEND_URL"
echo "数据库:       $DB_HOST"
echo ""
echo "🔐 重要信息（请保存）："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PostgreSQL 密码: $POSTGRES_PASSWORD"
echo "JWT Secret:      $JWT_SECRET"
echo ""
echo "📝 下一步："
echo "1. 继续运行主部署脚本完成前端部署"
echo "2. 或手动部署前端（参考 AZURE_DEPLOYMENT.md）"
