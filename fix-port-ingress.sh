#!/bin/bash

# 修复端口和 Ingress 配置

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
TARGET_PORT=3000

echo "=== 修复端口和 Ingress 配置 ==="
echo ""

# 1. 检查当前配置
echo "1. 检查当前配置..."
CONTAINER_PORT=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].ports[0].containerPort" -o tsv 2>/dev/null || echo "")

CURRENT_TARGET_PORT=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.targetPort" -o tsv 2>/dev/null || echo "")

echo "   当前容器端口: ${CONTAINER_PORT:-未设置}"
echo "   当前 Ingress targetPort: ${CURRENT_TARGET_PORT:-未设置}"
echo ""

# 2. 更新环境变量 PORT
echo "2. 设置环境变量 PORT=3000..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "PORT=3000" \
  --output none

echo "✅ 环境变量 PORT 已设置"
echo ""

# 3. 检查并更新 Ingress 配置
echo "3. 检查 Ingress 配置..."
INGRESS_ENABLED=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.external" -o tsv 2>/dev/null || echo "false")

if [ "$INGRESS_ENABLED" != "true" ] || [ "$CURRENT_TARGET_PORT" != "$TARGET_PORT" ]; then
    echo "   更新 Ingress 配置（targetPort: $TARGET_PORT）..."
    az containerapp ingress enable \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --type external \
      --target-port $TARGET_PORT \
      --transport http \
      --allow-insecure false \
      --output none
    
    echo "✅ Ingress 配置已更新"
else
    echo "✅ Ingress 配置正确"
fi

echo ""

# 4. 检查容器端口配置（需要更新镜像或重新配置）
echo "4. 检查容器端口配置..."
if [ -z "$CONTAINER_PORT" ] || [ "$CONTAINER_PORT" != "$TARGET_PORT" ]; then
    echo "⚠️  容器端口配置可能需要更新"
    echo "   注意：容器端口在 Dockerfile 中定义，需要重新构建镜像"
    echo "   当前配置：容器端口 ${CONTAINER_PORT:-未设置}，目标端口 $TARGET_PORT"
    echo ""
    echo "   如果应用仍然无法访问，请："
    echo "   1. 检查 Dockerfile 中的 EXPOSE 指令是否为 3000"
    echo "   2. 重新构建并部署镜像"
else
    echo "✅ 容器端口配置正确: $CONTAINER_PORT"
fi

echo ""

# 5. 等待配置生效
echo "5. 等待配置生效（30秒）..."
sleep 30

# 6. 测试健康检查
echo ""
echo "6. 测试健康检查..."
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
        echo "🎉 端口和 Ingress 配置已修复！"
        exit 0
    else
        echo "   ⏳ 等待中... ($RESPONSE)"
        sleep 10
    fi
done

echo ""
echo "⚠️  健康检查仍然失败"
echo ""
echo "请检查："
echo "  1. 运行 ./check-logs.sh 查看应用日志"
echo "  2. 确认应用是否成功启动（数据库连接等）"
echo "  3. 检查 Dockerfile 中的 EXPOSE 端口是否为 3000"
