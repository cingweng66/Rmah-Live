#!/bin/bash

# 后端状态检查脚本

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

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo_info "=== 检查后端 Container App 状态 ==="
echo ""

# 1. 检查 Container App 是否存在
echo_info "1. 检查 Container App..."
APP_EXISTS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query name -o tsv 2>/dev/null || echo "")

if [ -z "$APP_EXISTS" ]; then
    echo_error "❌ Container App '$BACKEND_NAME' 不存在"
    echo_warn "请检查名称是否正确，或查看所有 Container Apps："
    echo_warn "  az containerapp list --resource-group $RESOURCE_GROUP -o table"
    exit 1
fi

echo_info "✅ Container App 存在: $BACKEND_NAME"
echo ""

# 2. 检查运行状态
echo_info "2. 检查运行状态..."
APP_STATUS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.runningStatus" -o tsv 2>/dev/null || echo "")

REPLICAS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.scale.minReplicas" -o tsv 2>/dev/null || echo "0")

CURRENT_REPLICAS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.scale.minReplicas" -o tsv 2>/dev/null || echo "0")

echo "   运行状态: $APP_STATUS"
echo "   最小副本数: $REPLICAS"
echo ""

# 3. 获取 URL
echo_info "3. 获取后端 URL..."
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")

if [ -z "$BACKEND_URL" ]; then
    echo_error "❌ 无法获取后端 URL"
    exit 1
fi

echo_info "✅ 后端 URL: https://$BACKEND_URL"
echo ""

# 4. 测试健康检查端点
echo_info "4. 测试健康检查端点..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "https://$BACKEND_URL/health" 2>&1 || echo "ERROR")

if echo "$HEALTH_RESPONSE" | grep -q "HTTP_CODE:200"; then
    echo_info "✅ 健康检查通过"
    echo "$HEALTH_RESPONSE" | grep -v "HTTP_CODE" | head -5
else
    echo_error "❌ 健康检查失败"
    echo_error "响应: $HEALTH_RESPONSE"
fi
echo ""

# 5. 查看最近的日志
echo_info "5. 查看最近的日志（最后 20 行）..."
echo_warn "如果日志很多，可能需要等待..."
az containerapp logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --tail 20 \
  --follow false 2>/dev/null || echo_warn "无法获取日志"
echo ""

# 6. 检查环境变量
echo_info "6. 检查环境变量..."
ENV_VARS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env" -o json 2>/dev/null || echo "[]")

echo "   关键环境变量："
echo "$ENV_VARS" | grep -E "(DB_HOST|FRONTEND_URL|NODE_ENV)" || echo "   未找到关键环境变量"
echo ""

# 7. 检查 ingress 配置
echo_info "7. 检查 Ingress 配置..."
INGRESS_ENABLED=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.external" -o tsv 2>/dev/null || echo "false")

TARGET_PORT=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.targetPort" -o tsv 2>/dev/null || echo "")

echo "   Ingress 外部访问: $INGRESS_ENABLED"
echo "   目标端口: $TARGET_PORT"
echo ""

echo_info "=== 检查完成 ==="
echo ""
echo "💡 如果健康检查失败，请："
echo "   1. 查看日志: az containerapp logs show -g $RESOURCE_GROUP -n $BACKEND_NAME --tail 50"
echo "   2. 检查环境变量是否正确配置"
echo "   3. 检查数据库连接是否正常"
