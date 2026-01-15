#!/bin/bash

# 完整修复 ACR 认证问题

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
ACR_NAME="mahjongacr53114"

echo "=== 完整修复 ACR 认证问题 ==="
echo ""

# 1. 检查 ACR 状态
echo "1. 检查 ACR 状态..."
ACR_EXISTS=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query name -o tsv 2>/dev/null || echo "")

if [ -z "$ACR_EXISTS" ]; then
    echo "❌ ACR 不存在: $ACR_NAME"
    exit 1
fi

echo "✅ ACR 存在: $ACR_NAME"
echo ""

# 2. 确保 ACR 管理员用户已启用
echo "2. 确保 ACR 管理员用户已启用..."
ADMIN_ENABLED=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query adminUserEnabled -o tsv 2>/dev/null || echo "false")

if [ "$ADMIN_ENABLED" != "true" ]; then
    echo "   启用 ACR 管理员用户..."
    az acr update \
      --resource-group "$RESOURCE_GROUP" \
      --name "$ACR_NAME" \
      --admin-enabled true \
      --output none
    
    echo "✅ 管理员用户已启用"
    sleep 5
else
    echo "✅ 管理员用户已启用"
fi

echo ""

# 3. 获取 ACR 凭据
echo "3. 获取 ACR 凭据..."
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

echo "   ACR 登录服务器: $ACR_LOGIN_SERVER"
echo "   ACR 用户名: $ACR_USERNAME"
echo "   ACR 密码: ${ACR_PASSWORD:0:4}...（已隐藏）"
echo ""

# 4. 验证镜像是否存在
echo "4. 检查镜像是否存在..."
IMAGE_REPO="mahjong-backend-53114"
IMAGE_EXISTS=$(az acr repository show-tags \
  --name "$ACR_NAME" \
  --repository "$IMAGE_REPO" \
  --query "[?name=='latest'].name" -o tsv 2>/dev/null || echo "")

if [ -z "$IMAGE_EXISTS" ]; then
    echo "⚠️  镜像不存在: $IMAGE_REPO:latest"
    echo "   但继续执行，因为镜像可能刚刚推送"
    echo "   如果后续仍然失败，请重新构建并推送镜像"
else
    echo "✅ 镜像存在: $IMAGE_REPO:latest"
fi

echo ""

# 5. 检查当前 Container App 的 registry 配置
echo "5. 检查当前 Container App 的 registry 配置..."
CURRENT_REGISTRIES=$(az containerapp registry list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[].{Server:server, Username:username}" -o table 2>/dev/null || echo "")

echo "$CURRENT_REGISTRIES"
echo ""

# 6. 删除旧的 registry 配置（如果存在）
echo "6. 清理旧的 registry 配置..."
az containerapp registry remove \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --server "$ACR_LOGIN_SERVER" \
  --output none 2>/dev/null || echo "   没有旧的配置需要删除"

echo ""

# 7. 添加新的 registry 配置
echo "7. 添加新的 registry 配置..."
az containerapp registry set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --server "$ACR_LOGIN_SERVER" \
  --username "$ACR_USERNAME" \
  --password "$ACR_PASSWORD" \
  --output none

echo "✅ Registry 配置已添加"
echo ""

# 8. 验证 registry 配置
echo "8. 验证 registry 配置..."
VERIFIED_REGISTRIES=$(az containerapp registry list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[].{Server:server, Username:username}" -o table)

echo "$VERIFIED_REGISTRIES"
echo ""

# 9. 触发重启（通过更新镜像引用）
echo "9. 触发应用重启..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "RESTART_TRIGGER=$(date +%s)" \
  --output none

echo "✅ 重启已触发"
echo ""

# 10. 等待重启
echo "10. 等待应用重启（90秒）..."
sleep 90

# 11. 检查应用状态和日志
echo ""
echo "11. 检查应用状态..."
APP_STATUS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "{
    RunningStatus:properties.runningStatus,
    ActiveRevision:properties.latestRevisionName
  }" -o table)

echo "$APP_STATUS"
echo ""

# 12. 检查最新的 Replica 状态
LATEST_REVISION=$(az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[0].name" -o tsv)

echo "12. 检查 Replica 状态..."
REPLICA_STATUS=$(az containerapp replica list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --revision "$LATEST_REVISION" \
  --query "[].{Name:name, Status:properties.runningState, RestartCount:properties.containerStatuses[0].restartCount}" \
  -o table 2>/dev/null || echo "无法获取 Replica 信息")

echo "$REPLICA_STATUS"
echo ""

# 13. 检查系统日志中的镜像拉取状态
echo "13. 检查最近的系统日志..."
RECENT_LOGS=$(az containerapp logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --type system \
  --tail 10 \
  --follow false 2>&1 | grep -i "image\|pull\|unauthorized" | head -5 || echo "无相关日志")

if [ -n "$RECENT_LOGS" ]; then
    echo "$RECENT_LOGS"
else
    echo "   未发现镜像拉取错误"
fi

echo ""

# 14. 测试健康检查
echo "14. 测试健康检查..."
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "   后端 URL: https://$BACKEND_URL"
echo ""

for i in {1..5}; do
    echo "   尝试 $i/5..."
    RESPONSE=$(curl -s --max-time 10 "https://$BACKEND_URL/health" 2>&1 || echo "TIMEOUT")
    if echo "$RESPONSE" | grep -q "status\|ok\|healthy"; then
        echo ""
        echo "✅ 健康检查成功！"
        echo "   响应: $RESPONSE"
        echo ""
        echo "🎉 ACR 认证问题已修复！"
        exit 0
    else
        echo "   ⏳ 等待中... ($RESPONSE)"
        sleep 10
    fi
done

echo ""
echo "⚠️  健康检查仍然失败"
echo ""
echo "如果仍然看到 ImagePullUnauthorized 错误，请："
echo "  1. 确认镜像已正确推送到 ACR"
echo "  2. 在 Azure Portal 中手动检查 Container App 的 Registry 配置"
echo "  3. 尝试重新构建并推送镜像：./rebuild-and-deploy-backend.sh"
