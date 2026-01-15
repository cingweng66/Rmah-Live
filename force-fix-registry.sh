#!/bin/bash

# 强制修复 registry 配置

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
ACR_NAME="mahjongacr53114"

echo "=== 强制修复 Registry 配置 ==="
echo ""

# 1. 获取 ACR 信息
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

echo "ACR 登录服务器: $ACR_LOGIN_SERVER"
echo "ACR 用户名: $ACR_USERNAME"
echo ""

# 2. 删除所有现有的 registry 配置
echo "1. 删除所有现有的 registry 配置..."
EXISTING_REGISTRIES=$(az containerapp registry list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[].server" -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_REGISTRIES" ]; then
    for server in $EXISTING_REGISTRIES; do
        echo "   删除: $server"
        az containerapp registry remove \
          --resource-group "$RESOURCE_GROUP" \
          --name "$BACKEND_NAME" \
          --server "$server" \
          --output none 2>/dev/null || true
    done
fi

echo "✅ 旧的配置已删除"
echo ""

# 3. 添加新的 registry 配置
echo "2. 添加新的 registry 配置..."
az containerapp registry set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --server "$ACR_LOGIN_SERVER" \
  --username "$ACR_USERNAME" \
  --password "$ACR_PASSWORD" \
  --output none

echo "✅ Registry 配置已添加"
echo ""

# 4. 验证配置
echo "3. 验证 registry 配置..."
az containerapp registry list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --output table

echo ""

# 5. 更新 Container App，确保使用正确的镜像和 registry
echo "4. 更新 Container App 配置..."
IMAGE_NAME="$ACR_LOGIN_SERVER/mahjong-backend-53114:latest"

az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --image "$IMAGE_NAME" \
  --output none

echo "✅ Container App 已更新"
echo ""

# 6. 等待
echo "5. 等待配置生效（30秒）..."
sleep 30

# 7. 检查最新的 revision
echo ""
echo "6. 检查最新的 revision..."
LATEST_REVISION=$(az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[0].name" -o tsv)

echo "   最新 Revision: $LATEST_REVISION"
echo ""

# 8. 检查系统日志
echo "7. 检查系统日志（等待 30 秒后）..."
sleep 30

RECENT_LOGS=$(az containerapp logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --type system \
  --tail 10 \
  --follow false 2>&1 | grep -E "ImagePull|Pulling|Running|Started|Successfully" | tail -5 || echo "无相关日志")

echo "$RECENT_LOGS"
echo ""

echo "=== 修复完成 ==="
echo ""
echo "请等待几分钟，然后运行："
echo "  ./wait-and-test.sh"
echo ""
echo "或在 Azure Portal 中查看 Container App 的状态和日志"
