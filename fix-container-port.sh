#!/bin/bash

# 修复容器端口配置

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
ACR_NAME="mahjongacr53114"

echo "=== 修复容器端口配置 ==="
echo ""

# 1. 获取当前镜像信息
echo "1. 获取当前镜像信息..."
IMAGE_NAME=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].image" -o tsv 2>/dev/null || echo "")

if [ -z "$IMAGE_NAME" ]; then
    echo "❌ 无法获取镜像信息"
    exit 1
fi

echo "   当前镜像: $IMAGE_NAME"
echo ""

# 2. 更新 Container App，明确指定端口
echo "2. 更新 Container App 配置（设置容器端口 3000）..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "PORT=3000" \
  --output none

echo "✅ 环境变量已更新"
echo ""

# 3. 确保 Ingress 配置正确
echo "3. 确保 Ingress 配置正确..."
az containerapp ingress enable \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --type external \
  --target-port 3000 \
  --transport http \
  --allow-insecure false \
  --output none

echo "✅ Ingress 配置已更新"
echo ""

# 4. 触发重启（通过更新镜像标签）
echo "4. 触发应用重启..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "RESTART_TRIGGER=$(date +%s)" \
  --output none

echo "✅ 重启已触发"
echo ""

# 5. 等待重启
echo "5. 等待应用重启（60秒）..."
sleep 60

# 6. 检查应用状态
echo ""
echo "6. 检查应用状态..."
APP_STATUS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "{
    RunningStatus:properties.runningStatus,
    MinReplicas:properties.template.scale.minReplicas,
    ActiveRevision:properties.latestRevisionName
  }" -o table)

echo "$APP_STATUS"
echo ""

# 7. 测试健康检查
echo "7. 测试健康检查..."
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
        echo "🎉 端口配置已修复！"
        exit 0
    else
        echo "   ⏳ 等待中... ($RESPONSE)"
        sleep 10
    fi
done

echo ""
echo "⚠️  健康检查仍然失败"
echo ""
echo "可能的原因："
echo "  1. 应用启动失败（数据库连接问题）"
echo "  2. 应用崩溃"
echo ""
echo "请运行："
echo "  ./check-logs.sh 查看详细日志"
echo "  ./fix-db-connection.sh 修复数据库连接"
