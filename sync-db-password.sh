#!/bin/bash

# 同步数据库密码到 Container App（数据库密码已在 Azure Portal 中修改）

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 同步数据库密码到 Container App ==="
echo ""
echo "请在 Azure Portal 中确认已修改 PostgreSQL 密码"
echo ""

# 提示输入新密码
read -sp "请输入新的 PostgreSQL 密码: " NEW_PASSWORD
echo ""
echo ""

# 1. 更新 Container App 环境变量
echo "1. 更新 Container App 环境变量..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "DB_PASSWORD=$NEW_PASSWORD" \
  --output none

echo "✅ Container App 环境变量已更新"
echo ""

# 2. 等待 Container App 重启
echo "2. 等待 Container App 重启（30秒）..."
sleep 30

# 3. 测试健康检查
echo ""
echo "3. 测试健康检查..."
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
        echo "🎉 后端已正常运行！"
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
echo "  1. 运行: ./check-logs.sh 查看应用日志"
echo "  2. 在 Azure Portal 中查看 Container App 的 Log stream"
echo "  3. 确认密码是否正确"
echo "  4. 检查数据库防火墙规则"
