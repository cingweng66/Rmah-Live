#!/bin/bash

# 简单的重启脚本

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 重启后端 Container App ==="
echo ""

# 方法 1: 通过更新环境变量触发重启
echo "方法 1: 通过更新环境变量触发重启..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "RESTART_TRIGGER=$(date +%s)" \
  --output none

echo "✅ 重启已触发（等待 30 秒）..."
sleep 30

# 测试健康检查
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo ""
echo "测试健康检查..."
curl -s --max-time 10 "https://$BACKEND_URL/health" | head -5 || echo "健康检查失败"
