#!/bin/bash

# Azure 部署脚本 - 日麻直播记分系统
# 使用方法: ./deploy-azure.sh

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# SSL 证书验证配置
# 如果遇到 SSL 证书验证错误，可以设置以下环境变量：
# export REQUESTS_CA_BUNDLE=/path/to/cert.pem
# 或者临时禁用 SSL 验证（不推荐，仅用于测试）：
# export AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1

# 检查是否在代理/VPN环境中
if [ -n "$HTTP_PROXY" ] || [ -n "$HTTPS_PROXY" ]; then
    echo_warn "检测到代理/VPN 环境"
    echo_warn "如果遇到 SSL 证书错误，可以选择："
    echo_warn "  1. 临时禁用 SSL 验证（仅用于部署）"
    echo_warn "  2. 配置 VPN 证书"
    echo ""
    read -p "是否临时禁用 SSL 验证以继续部署？(y/n，默认 y): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z "$REPLY" ]]; then
        echo_warn "⚠️  临时禁用 SSL 验证（仅用于本次部署）"
        export AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1
        echo_info "已设置 AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1"
        echo_warn "部署完成后，建议取消此设置：unset AZURE_CLI_DISABLE_CONNECTION_VERIFICATION"
    else
        echo_info "继续使用默认 SSL 验证"
        echo_warn "如果遇到错误，可以手动配置证书："
        echo_warn "  export REQUESTS_CA_BUNDLE=/path/to/cert.pem"
    fi
fi

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
RESOURCE_GROUP="mahjong-live"

# 生成随机资源名称
BACKEND_NAME="mahjong-backend-$(date +%s | tail -c 6)"
# Storage Account 名称只能包含小写字母和数字，且必须全局唯一
STORAGE_ACCOUNT_NAME="mahjongweb$(date +%s | tail -c 8 | tr '[:upper:]' '[:lower:]')"
POSTGRES_NAME="mahjong-postgres-$(date +%s | tail -c 6)"
REDIS_NAME="mahjong-redis-$(date +%s | tail -c 6)"
ACR_NAME="mahjongacr$(date +%s | tail -c 6)"
CONTAINER_ENV_NAME="mahjong-env-$(date +%s | tail -c 6)"

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

# 检查当前订阅
CURRENT_SUB=$(az account show --query id -o tsv 2>/dev/null || echo "")
CURRENT_SUB_NAME=$(az account show --query name -o tsv 2>/dev/null || echo "")

if [ -z "$CURRENT_SUB" ]; then
    echo_error "无法获取当前订阅信息"
    echo_warn "请运行以下命令检查："
    echo_warn "  az account list"
    echo_warn "  az account set --subscription <subscription-id>"
    exit 1
fi

echo_info "当前订阅 ID: $CURRENT_SUB"
echo_info "当前订阅名称: $CURRENT_SUB_NAME"
echo ""

# 列出可用订阅
echo_info "可用订阅列表："
az account list --query "[].{Name:name, ID:id, IsDefault:isDefault}" -o table
echo ""

# 确认使用当前订阅
read -p "是否使用当前订阅继续部署？(y/n，默认 y): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo_info "请先切换订阅："
    echo_info "  az account list"
    echo_info "  az account set --subscription <subscription-id>"
    exit 0
fi
echo ""

# 检测允许的区域
echo_info "检测 Azure 订阅允许的区域..."
AVAILABLE_LOCATIONS=$(az account list-locations --query "[?metadata.regionCategory=='Recommended'].name" -o tsv 2>/dev/null || echo "")

# 如果无法获取或为空，使用包含 eastasia 的默认列表
if [ -z "$AVAILABLE_LOCATIONS" ] || [ "$AVAILABLE_LOCATIONS" = "" ]; then
    AVAILABLE_LOCATIONS="eastasia eastus westus2 westeurope southeastasia japaneast koreacentral"
    echo_warn "无法自动检测区域，使用默认列表（包含 eastasia）"
else
    # 确保 eastasia 在列表中（如果用户订阅支持）
    if ! echo "$AVAILABLE_LOCATIONS" | grep -q "eastasia"; then
        # 如果检测到的列表中没有 eastasia，但用户想用，我们仍然允许
        echo_warn "检测到的区域列表中没有 eastasia，但您仍可直接输入使用"
    fi
fi

echo_info "可用推荐区域："
LOCATION_ARRAY=($AVAILABLE_LOCATIONS)
for i in "${!LOCATION_ARRAY[@]}"; do
    echo "  $((i+1)). ${LOCATION_ARRAY[$i]}"
done

# 让用户选择区域
echo ""
echo_warn "提示：您可以直接输入 'eastasia' 使用东亚区域"
read -p "请选择区域编号（1-${#LOCATION_ARRAY[@]}）或直接输入区域名称（如 eastasia）: " LOCATION_INPUT

if [[ "$LOCATION_INPUT" =~ ^[0-9]+$ ]] && [ "$LOCATION_INPUT" -ge 1 ] && [ "$LOCATION_INPUT" -le "${#LOCATION_ARRAY[@]}" ]; then
    # 输入的是有效数字
    LOCATION="${LOCATION_ARRAY[$((LOCATION_INPUT-1))]}"
else
    # 输入的是区域名称或无效输入
    if [[ "$LOCATION_INPUT" != "" ]]; then
        LOCATION="$LOCATION_INPUT"
    else
        # 默认使用 eastasia（如果可用）或第一个
        if echo "$AVAILABLE_LOCATIONS" | grep -q "eastasia"; then
            LOCATION="eastasia"
            echo_info "未输入，使用默认区域: $LOCATION"
        else
            LOCATION="${LOCATION_ARRAY[0]}"
            echo_warn "未输入，使用默认区域: $LOCATION"
        fi
    fi
fi

echo_info "选择的区域: $LOCATION"
echo ""

# 确认部署
read -p "是否继续部署到区域 $LOCATION？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo_info "=== 开始部署到 Azure ==="

# 1. 创建或检查资源组
echo_info "1. 检查资源组: $RESOURCE_GROUP"
EXISTING_RG=$(az group show --name $RESOURCE_GROUP --query location -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_RG" ]; then
    echo_warn "资源组已存在，位置: $EXISTING_RG"
    if [ "$EXISTING_RG" != "$LOCATION" ]; then
        echo_error "资源组已存在于区域 '$EXISTING_RG'，但您选择了区域 '$LOCATION'"
        echo_warn "将使用现有资源组的区域: $EXISTING_RG"
        LOCATION="$EXISTING_RG"
    fi
else
    echo_info "创建资源组: $RESOURCE_GROUP (区域: $LOCATION)"
    az group create --name $RESOURCE_GROUP --location $LOCATION
fi

# 2. 部署 PostgreSQL
echo_info "2. 部署 PostgreSQL 数据库..."

# 检查资源组中是否已有 PostgreSQL 服务器
EXISTING_POSTGRES_LIST=$(az postgres flexible-server list \
  --resource-group "$RESOURCE_GROUP" \
  --query "[].name" -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_POSTGRES_LIST" ]; then
    POSTGRES_COUNT=$(echo "$EXISTING_POSTGRES_LIST" | wc -l | tr -d ' ')
    if [ "$POSTGRES_COUNT" -eq 1 ]; then
        EXISTING_POSTGRES_NAME=$(echo "$EXISTING_POSTGRES_LIST" | head -n 1)
        echo_warn "检测到已存在的 PostgreSQL 服务器: $EXISTING_POSTGRES_NAME"
        read -p "是否使用已存在的 PostgreSQL 服务器？(y/n，默认 y): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            POSTGRES_NAME="$EXISTING_POSTGRES_NAME"
            echo_info "使用已存在的 PostgreSQL 服务器: $POSTGRES_NAME"
            echo_warn "注意：如果不知道密码，需要在 Azure Portal 中重置密码"
        else
            echo_info "将创建新的 PostgreSQL 服务器: $POSTGRES_NAME"
            POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
            echo_warn "PostgreSQL 密码: $POSTGRES_PASSWORD (请保存)"
        fi
    else
        echo_warn "检测到多个 PostgreSQL 服务器，将创建新的: $POSTGRES_NAME"
        POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
        echo_warn "PostgreSQL 密码: $POSTGRES_PASSWORD (请保存)"
    fi
else
    echo_info "未检测到已存在的 PostgreSQL 服务器，将创建新的: $POSTGRES_NAME"
    POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    echo_warn "PostgreSQL 密码: $POSTGRES_PASSWORD (请保存)"
fi

# 检查指定的 PostgreSQL 服务器是否已存在
EXISTING_POSTGRES=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query name -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_POSTGRES" ]; then
    echo_warn "PostgreSQL 服务器已存在: $POSTGRES_NAME"
else
    echo_info "创建 PostgreSQL 服务器: $POSTGRES_NAME..."
    az postgres flexible-server create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$POSTGRES_NAME" \
      --location "$LOCATION" \
      --admin-user postgres \
      --admin-password "$POSTGRES_PASSWORD" \
      --sku-name Standard_B1ms \
      --tier Burstable \
      --version 15 \
      --storage-size 32 \
      --public-access 0.0.0.0 \
      --output none
fi

# 检查数据库是否已存在
EXISTING_DB=$(az postgres flexible-server db show \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$POSTGRES_NAME" \
  --database-name mahjong_db \
  --query name -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_DB" ]; then
    echo_warn "数据库 mahjong_db 已存在"
else
    echo_info "创建数据库 mahjong_db..."
    az postgres flexible-server db create \
      --resource-group "$RESOURCE_GROUP" \
      --server-name "$POSTGRES_NAME" \
      --database-name mahjong_db \
      --output none
fi

DB_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query fullyQualifiedDomainName -o tsv)

if [ -n "$DB_HOST" ]; then
    echo_info "PostgreSQL 服务器: $DB_HOST"
else
    echo_error "无法获取 PostgreSQL 服务器信息"
    exit 1
fi

# 如果使用已存在的服务器，需要获取或设置密码
if [ -n "$EXISTING_POSTGRES" ] && [ -z "$POSTGRES_PASSWORD" ]; then
    echo_warn "使用已存在的 PostgreSQL 服务器，需要密码"
    echo_warn "如果不知道密码，请在 Azure Portal 中重置，或运行："
    echo_warn "  az postgres flexible-server update -g $RESOURCE_GROUP -n $POSTGRES_NAME -p <新密码>"
    read -sp "请输入 PostgreSQL 密码（如果不知道，请按 Ctrl+C 取消，先重置密码）: " POSTGRES_PASSWORD
    echo
fi

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
    EXISTING_REDIS=$(az redis show \
      --resource-group "$RESOURCE_GROUP" \
      --name "$REDIS_NAME" \
      --query name -o tsv 2>/dev/null || echo "")

    if [ -n "$EXISTING_REDIS" ]; then
        echo_warn "Redis 缓存已存在: $REDIS_NAME"
    else
        echo_info "创建 Redis 缓存..."
        if az redis create \
          --resource-group "$RESOURCE_GROUP" \
          --name "$REDIS_NAME" \
          --location "$LOCATION" \
          --sku Basic \
          --vm-size c0 \
          --output none 2>/dev/null; then
            echo_info "Redis 创建成功"
        else
            echo_error "Redis 创建失败（可能是区域限制或配额问题）"
            echo_warn "将继续部署，系统将使用内存缓存"
            USE_REDIS=false
        fi
    fi

    if [ "$USE_REDIS" = true ]; then
        REDIS_HOST=$(az redis show \
          --resource-group "$RESOURCE_GROUP" \
          --name "$REDIS_NAME" \
          --query hostName -o tsv 2>/dev/null || echo "")

        if [ -n "$REDIS_HOST" ]; then
            REDIS_KEY=$(az redis list-keys \
              --resource-group "$RESOURCE_GROUP" \
              --name "$REDIS_NAME" \
              --query primaryKey -o tsv 2>/dev/null || echo "")
            echo_info "Redis 已配置: $REDIS_HOST"
        else
            echo_warn "无法获取 Redis 信息，将使用内存缓存"
            USE_REDIS=false
        fi
    fi
else
    echo_info "跳过 Redis 部署，将使用内存缓存"
fi

# 4. 部署后端 (Container Apps)
echo_info "4. 部署后端 (Azure Container Apps)..."
echo_info "使用 Container Apps 的优势："
echo_info "  - 免费 Consumption 计划（按使用量付费）"
echo_info "  - 自动扩缩容"
echo_info "  - 原生支持 WebSocket"
echo_info "  - 更适合容器化应用"

# 4.1 创建 Azure Container Registry
echo_info "4.1 创建 Azure Container Registry: $ACR_NAME"
EXISTING_ACR=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query name -o tsv 2>/dev/null || echo "")

if [ -z "$EXISTING_ACR" ]; then
    echo_info "创建 ACR（这可能需要几分钟）..."
    az acr create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$ACR_NAME" \
      --sku Basic \
      --admin-enabled true \
      --output none
    echo_info "ACR 创建完成"
else
    echo_warn "ACR 已存在: $ACR_NAME"
fi

# 获取 ACR 登录服务器和凭据
ACR_LOGIN_SERVER=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query loginServer -o tsv)

ACR_USERNAME=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query username -o tsv)

ACR_PASSWORD=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query passwords[0].value -o tsv)

echo_info "ACR 登录服务器: $ACR_LOGIN_SERVER"

# 4.2 构建并推送 Docker 镜像
echo_info "4.2 构建并推送 Docker 镜像..."
cd "$(dirname "$0")/backend"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo_error "Docker 未安装。请先安装 Docker Desktop"
    echo_error "macOS: brew install --cask docker"
    exit 1
fi

# 登录 ACR
echo_info "登录到 ACR..."
echo "$ACR_PASSWORD" | docker login "$ACR_LOGIN_SERVER" -u "$ACR_USERNAME" --password-stdin

# 构建镜像
IMAGE_NAME="${ACR_LOGIN_SERVER}/${BACKEND_NAME}:latest"
echo_info "构建镜像: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

# 推送镜像
echo_info "推送镜像到 ACR..."
docker push "$IMAGE_NAME"

echo_info "镜像已推送: $IMAGE_NAME"
cd "$(dirname "$0")"

# 4.3 创建 Container Apps Environment
echo_info "4.3 创建 Container Apps Environment: $CONTAINER_ENV_NAME"
EXISTING_ENV=$(az containerapp env show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CONTAINER_ENV_NAME" \
  --query name -o tsv 2>/dev/null || echo "")

if [ -z "$EXISTING_ENV" ]; then
    echo_info "创建 Container Apps Environment（这可能需要几分钟）..."
    echo_warn "注意：如果遇到 SSL 证书错误，请等待重试或检查网络连接"
    
    # 重试机制：最多重试 3 次
    MAX_RETRIES=3
    RETRY_COUNT=0
    SUCCESS=false
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        set +e  # 临时禁用错误退出
        if az containerapp env create \
          --name "$CONTAINER_ENV_NAME" \
          --resource-group "$RESOURCE_GROUP" \
          --location "$LOCATION" \
          --output none 2>&1; then
            set -e  # 恢复错误退出
            SUCCESS=true
            break
        else
            set -e  # 恢复错误退出
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                echo_warn "创建失败，等待 ${RETRY_COUNT}0 秒后重试 ($RETRY_COUNT/$MAX_RETRIES)..."
                sleep ${RETRY_COUNT}0
            fi
        fi
    done
    
    if [ "$SUCCESS" = true ]; then
        echo_info "Environment 创建完成"
    else
        echo_error "Environment 创建失败，已重试 $MAX_RETRIES 次"
        echo_error "如果遇到 SSL 证书错误，请尝试："
        echo_error "  1. 配置代理证书: export REQUESTS_CA_BUNDLE=/path/to/cert.pem"
        echo_error "  2. 或检查网络连接和代理设置"
        exit 1
    fi
else
    echo_warn "Environment 已存在: $CONTAINER_ENV_NAME"
fi

# 4.4 生成 JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# 4.5 创建 Container App
echo_info "4.4 创建 Container App: $BACKEND_NAME"
EXISTING_APP=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query name -o tsv 2>/dev/null || echo "")

# 注意：FRONTEND_URL 将在前端部署后更新
FRONTEND_URL_PLACEHOLDER="https://placeholder.frontend.url"

if [ -z "$EXISTING_APP" ]; then
    # 准备环境变量
    ENV_VARS="NODE_ENV=production PORT=3000 DB_HOST=$DB_HOST DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=$POSTGRES_PASSWORD DB_DATABASE=mahjong_db JWT_SECRET=$JWT_SECRET JWT_EXPIRES_IN=7d FRONTEND_URL=$FRONTEND_URL_PLACEHOLDER"
    
    if [ "$USE_REDIS" = true ] && [ -n "$REDIS_HOST" ]; then
        ENV_VARS="$ENV_VARS REDIS_HOST=${REDIS_HOST}:6380 REDIS_PASSWORD=$REDIS_KEY"
    else
        ENV_VARS="$ENV_VARS REDIS_HOST= REDIS_PASSWORD="
    fi

    echo_info "创建 Container App..."
    echo_warn "注意：如果遇到 SSL 证书错误，请等待重试或检查网络连接"
    
    # 重试机制：最多重试 3 次
    MAX_RETRIES=3
    RETRY_COUNT=0
    SUCCESS=false
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        set +e  # 临时禁用错误退出
        if az containerapp create \
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
          --output none 2>&1; then
            set -e  # 恢复错误退出
            SUCCESS=true
            break
        else
            set -e  # 恢复错误退出
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                echo_warn "创建失败，等待 ${RETRY_COUNT}0 秒后重试 ($RETRY_COUNT/$MAX_RETRIES)..."
                sleep ${RETRY_COUNT}0
            fi
        fi
    done
    
    if [ "$SUCCESS" = true ]; then
        echo_info "Container App 创建完成"
    else
        echo_error "Container App 创建失败，已重试 $MAX_RETRIES 次"
        echo_error "如果遇到 SSL 证书错误，请尝试："
        echo_error "  1. 配置代理证书: export REQUESTS_CA_BUNDLE=/path/to/cert.pem"
        echo_error "  2. 或检查网络连接和代理设置"
        echo_error "  3. 或手动创建 Container App（参考 Azure Portal）"
        exit 1
    fi
else
    echo_warn "Container App 已存在: $BACKEND_NAME"
    echo_info "更新 Container App 配置..."
    
    # 准备环境变量
    ENV_VARS="NODE_ENV=production PORT=3000 DB_HOST=$DB_HOST DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=$POSTGRES_PASSWORD DB_DATABASE=mahjong_db JWT_SECRET=$JWT_SECRET JWT_EXPIRES_IN=7d FRONTEND_URL=$FRONTEND_URL_PLACEHOLDER"
    
    if [ "$USE_REDIS" = true ] && [ -n "$REDIS_HOST" ]; then
        ENV_VARS="$ENV_VARS REDIS_HOST=${REDIS_HOST}:6380 REDIS_PASSWORD=$REDIS_KEY"
    else
        ENV_VARS="$ENV_VARS REDIS_HOST= REDIS_PASSWORD="
    fi

    az containerapp update \
      --name "$BACKEND_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --image "$IMAGE_NAME" \
      --env-vars $ENV_VARS \
      --output none
fi

# 获取 Container App URL
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query properties.configuration.ingress.fqdn -o tsv)

if [ -n "$BACKEND_URL" ]; then
    echo_info "后端已创建: https://$BACKEND_URL"
else
    echo_warn "无法获取后端 URL，请稍后在 Azure Portal 中查看"
    BACKEND_URL="<待获取>"
fi

# 5. 部署前端 (Azure Storage Static Website)
echo_info "5. 部署前端 (Azure Storage Static Website)..."
echo_warn "注意：使用 Azure Storage Static Website（支持学生订阅）"
echo_info "前端可以部署到任何支持的区域，建议使用 $LOCATION"

# 检查 Storage Account 是否已存在
EXISTING_STORAGE=$(az storage account show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT_NAME" \
  --query name -o tsv 2>/dev/null || echo "")

if [ -z "$EXISTING_STORAGE" ]; then
    echo_info "创建 Storage Account: $STORAGE_ACCOUNT_NAME"
    
    # 临时禁用 SSL 验证（如果设置了）
    SSL_VERIFY_DISABLED=false
    if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
        SSL_VERIFY_DISABLED=true
        set +e
    fi
    
    # 创建 Storage Account 并捕获错误
    CREATE_OUTPUT=$(az storage account create \
      --name "$STORAGE_ACCOUNT_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --location "$LOCATION" \
      --sku Standard_LRS \
      --kind StorageV2 \
      --output json 2>&1)
    
    CREATE_EXIT_CODE=$?
    
    if [ "$SSL_VERIFY_DISABLED" = true ]; then
        set -e
    fi
    
    # 检查创建是否成功
    if [ $CREATE_EXIT_CODE -eq 0 ]; then
        # 验证 Storage Account 是否真的存在
        sleep 2
        VERIFY_STORAGE=$(az storage account show \
          --resource-group "$RESOURCE_GROUP" \
          --name "$STORAGE_ACCOUNT_NAME" \
          --query name -o tsv 2>/dev/null || echo "")
        
        if [ -n "$VERIFY_STORAGE" ]; then
            echo_info "✅ Storage Account 创建成功并已验证"
        else
            echo_error "❌ Storage Account 创建失败（验证时未找到）"
            echo_error "错误信息: $CREATE_OUTPUT"
            echo_warn ""
            echo_warn "可能的原因："
            echo_warn "  1. 订阅不存在或已过期（SubscriptionNotFound）"
            echo_warn "  2. 资源组不存在"
            echo_warn "  3. 权限不足"
            echo_warn ""
            echo_warn "请检查："
            echo_warn "  ./check-azure-subscription.sh"
            echo_warn "  或运行: az account show"
            echo_warn "  或运行: az account list"
            exit 1
        fi
    else
        echo_error "❌ Storage Account 创建失败"
        echo_error "错误信息: $CREATE_OUTPUT"
        
        # 检查是否是订阅问题
        if echo "$CREATE_OUTPUT" | grep -q "SubscriptionNotFound"; then
            echo_error ""
            echo_error "🔴 订阅未找到！"
            echo_error "当前订阅 ID 可能已过期或被删除"
            echo_error ""
            echo_error "解决方案："
            echo_error "  1. 检查可用订阅: az account list"
            echo_error "  2. 切换订阅: az account set --subscription <subscription-id>"
            echo_error "  3. 或创建新订阅后重新登录: az login"
            exit 1
        fi
        
        echo_warn ""
        echo_warn "可能的原因："
        echo_warn "  1. 订阅问题（请检查当前订阅）"
        echo_warn "  2. 资源组不存在"
        echo_warn "  3. Storage Account 名称已被使用"
        echo_warn "  4. 权限不足"
        echo_warn ""
        echo_warn "请检查："
        echo_warn "  ./check-azure-subscription.sh"
        echo_warn "  az account show"
        echo_warn "  az group show --name $RESOURCE_GROUP"
        exit 1
    fi
else
    echo_warn "Storage Account 已存在: $STORAGE_ACCOUNT_NAME"
fi

# 启用静态网站托管
echo_info "启用静态网站托管..."
STORAGE_KEY=$(az storage account keys list \
  --resource-group "$RESOURCE_GROUP" \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --query "[0].value" -o tsv)

# 临时禁用 SSL 验证（如果设置了）
if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
    set +e
fi

az storage blob service-properties update \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --account-key "$STORAGE_KEY" \
  --static-website \
  --404-document index.html \
  --index-document index.html \
  --output none

if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
    set -e
fi

# 获取静态网站 URL
STORAGE_ENDPOINT=$(az storage account show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT_NAME" \
  --query "primaryEndpoints.web" -o tsv)

FRONTEND_URL="${STORAGE_ENDPOINT%/}"

echo_info "静态网站 URL: $FRONTEND_URL"

# 构建前端（使用后端 URL 作为环境变量）
echo_info "构建前端（使用后端 URL: https://$BACKEND_URL）..."
cd "$(dirname "$0")"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo_info "安装前端依赖..."
    npm install
fi

# 使用环境变量构建（在构建时注入，因为 Storage 不支持运行时环境变量）
export VITE_API_URL="https://$BACKEND_URL"
export VITE_WS_URL="wss://$BACKEND_URL"
echo_info "构建配置:"
echo_info "  VITE_API_URL=$VITE_API_URL"
echo_info "  VITE_WS_URL=$VITE_WS_URL"

npm run build

if [ ! -d "dist" ]; then
    echo_error "构建失败，dist 目录不存在"
    exit 1
fi

echo_info "前端构建完成"

# 上传文件到 Storage Account 的 $web 容器
echo_info "上传前端文件到 Storage Account..."
cd dist

# 临时禁用 SSL 验证（如果设置了）
if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
    set +e
fi

# 上传所有文件（使用通配符）
az storage blob upload-batch \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --account-key "$STORAGE_KEY" \
  --destination '$web' \
  --source . \
  --output none

if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
    set -e
fi

cd ..

echo_info "前端文件上传完成"

# 设置容器访问级别为公共读取
echo_info "设置容器访问级别..."
if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
    set +e
fi

az storage container set-permission \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --account-key "$STORAGE_KEY" \
  --name '$web' \
  --public-access blob \
  --output none

if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
    set -e
fi

echo_info "前端已部署: $FRONTEND_URL"

# 更新 Container App 的 FRONTEND_URL 环境变量
if [ -n "$BACKEND_URL" ] && [ "$BACKEND_URL" != "<待获取>" ]; then
    echo_info "更新 Container App 的 FRONTEND_URL 环境变量..."
    if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
        set +e
    fi
    
    az containerapp update \
      --name "$BACKEND_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --set-env-vars "FRONTEND_URL=$FRONTEND_URL" \
      --output none
    
    if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
        set -e
    fi
    
    echo_info "CORS 已配置为允许前端: $FRONTEND_URL"
fi

# 6. 配置 CORS（Container Apps 通过 ingress 配置）
echo_info "6. 配置 CORS..."
if [ -n "$FRONTEND_URL" ] && [ -n "$BACKEND_URL" ]; then
    echo_info "Container Apps 的 CORS 需要在应用代码中配置"
    echo_info "前端 URL: https://$FRONTEND_URL"
    echo_info "后端 URL: https://$BACKEND_URL"
    echo_warn "请确保后端代码中已配置 CORS 允许前端域名"
else
    echo_warn "URL 未完全获取，请稍后手动配置 CORS"
fi

# 7. 后端代码已通过 Docker 镜像部署
echo_info "7. 后端代码已通过 Docker 镜像部署到 Container Apps"
echo_info "如需更新代码，请重新构建并推送镜像："
echo_info "  cd backend"
echo_info "  docker build -t $IMAGE_NAME ."
echo_info "  docker push $IMAGE_NAME"
echo_info "  az containerapp update -g $RESOURCE_GROUP -n $BACKEND_NAME --image $IMAGE_NAME"

echo_info "=== 部署完成 ==="
echo ""
echo "📋 部署信息："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -n "$FRONTEND_URL" ]; then
    echo "前端 URL:     $FRONTEND_URL"
else
    echo "前端 URL:     请在 Azure Portal 中查看 Storage Account 的静态网站 URL"
fi
echo "后端 URL:     https://$BACKEND_URL"
echo "数据库:       $DB_HOST"
if [ "$USE_REDIS" = true ] && [ -n "$REDIS_HOST" ]; then
    echo "Redis:        $REDIS_HOST"
else
    echo "Redis:        未部署（使用内存缓存）"
fi
echo "部署区域:     $LOCATION"
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
echo "4. Container Apps 使用 Consumption 计划（按使用量付费）"
echo "5. 如需更新后端代码，重新构建并推送 Docker 镜像"
echo ""
echo "🔄 更新后端代码："
echo "  cd backend"
echo "  docker build -t $IMAGE_NAME ."
echo "  docker push $IMAGE_NAME"
echo "  az containerapp update -g $RESOURCE_GROUP -n $BACKEND_NAME --image $IMAGE_NAME"
