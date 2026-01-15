#!/bin/bash

# 后端修复脚本

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 修复后端 Container App ==="
echo ""

# 1. 确保至少有一个副本运行
echo "1. 设置最小副本数为 1..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --min-replicas 1 \
  --max-replicas 3 \
  --output none

echo "✅ 副本数已更新"
echo ""

# 2. 等待几秒让容器启动
echo "2. 等待容器启动..."
sleep 10

# 3. 检查状态
echo "3. 检查状态..."
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "后端 URL: https://$BACKEND_URL"
echo ""

# 4. 测试健康检查
echo "4. 测试健康检查..."
sleep 5
curl -s "https://$BACKEND_URL/health" | head -3 || echo "健康检查失败"
echo ""

echo "=== 修复完成 ==="
echo ""
echo "如果仍然无法访问，请查看日志："
echo "  az containerapp logs show -g $RESOURCE_GROUP -n $BACKEND_NAME --tail 50"
