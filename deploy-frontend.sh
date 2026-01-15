#!/bin/bash

# 前端部署脚本 - 使用 Azure Storage Static Website
# 支持学生订阅

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

echo_info "=== 部署前端到 Azure Storage Static Website ==="
echo_warn "使用 Azure Storage Static Website（支持学生订阅）"
echo ""

# 配置变量
RESOURCE_GROUP="mahjong-live"

# 读取信息
read -p "请输入后端 URL (例如: https://mahjong-backend-53114.bravedune-94e72c8f.francecentral.azurecontainerapps.io): " BACKEND_URL
if [ -z "$BACKEND_URL" ]; then
    echo_error "后端 URL 不能为空"
    exit 1
fi

read -p "请输入区域 (例如: francecentral，默认 francecentral): " LOCATION
LOCATION=${LOCATION:-francecentral}

# 检查或创建 Storage Account
read -p "请输入 Storage Account 名称（留空自动生成，只能包含小写字母和数字）: " STORAGE_ACCOUNT_INPUT
if [ -z "$STORAGE_ACCOUNT_INPUT" ]; then
    STORAGE_ACCOUNT_NAME="mahjongweb$(date +%s | tail -c 8 | tr '[:upper:]' '[:lower:]')"
    echo_info "使用自动生成的 Storage Account 名称: $STORAGE_ACCOUNT_NAME"
else
    STORAGE_ACCOUNT_NAME="$STORAGE_ACCOUNT_INPUT"
    # 验证名称格式
    if [[ ! "$STORAGE_ACCOUNT_NAME" =~ ^[a-z0-9]{3,24}$ ]]; then
        echo_error "Storage Account 名称只能包含小写字母和数字，长度 3-24 个字符"
        exit 1
    fi
fi

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

# 构建前端
echo_info "构建前端（使用后端 URL: $BACKEND_URL）..."
cd "$(dirname "$0")"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo_info "安装前端依赖..."
    npm install
fi

# 使用环境变量构建（在构建时注入，因为 Storage 不支持运行时环境变量）
export VITE_API_URL="$BACKEND_URL"
export VITE_WS_URL="${BACKEND_URL/https:/wss:}"
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

# 上传所有文件
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
read -p "请输入 Container App 名称 (例如: mahjong-backend-53114，留空跳过): " BACKEND_APP_NAME
if [ -n "$BACKEND_APP_NAME" ]; then
    echo_info "更新 Container App 的 FRONTEND_URL 环境变量..."
    
    # 临时禁用 SSL 验证（如果设置了）
    if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
        set +e
    fi
    
    az containerapp update \
      --name "$BACKEND_APP_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --set-env-vars "FRONTEND_URL=$FRONTEND_URL" \
      --output none
    
    if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
        set -e
    fi
    
    echo_info "CORS 已配置为允许前端: $FRONTEND_URL"
fi

echo_info "=== 前端部署完成 ==="
echo ""
echo "📋 部署信息："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "前端 URL:     $FRONTEND_URL"
echo "后端 URL:     $BACKEND_URL"
echo "Storage Account: $STORAGE_ACCOUNT_NAME"
echo ""
echo "📝 下一步："
echo "1. 访问前端 URL 测试应用: $FRONTEND_URL"
echo "2. 检查前端是否能正常连接到后端"
echo "3. 如果遇到 CORS 错误，检查后端代码中的 CORS 配置"
echo ""
echo "💡 提示："
echo "- 前端文件已上传到 Storage Account 的 \$web 容器"
echo "- 如需更新前端，重新运行此脚本或手动上传文件到 \$web 容器"
