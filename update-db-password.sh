#!/bin/bash

# 更新数据库密码并同步到 Container App

set -e

RESOURCE_GROUP="mahjong-live"
POSTGRES_NAME="mahjong-postgres-50831"
BACKEND_NAME="mahjong-backend-53114"
NEW_PASSWORD="SQzyzxlzh2002%%"

echo "=== 更新数据库密码 ==="
echo ""

# 1. 更新 PostgreSQL 密码
echo "1. 更新 PostgreSQL 密码..."
az postgres flexible-server update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --admin-password "$NEW_PASSWORD" \
  --output none

echo "✅ PostgreSQL 密码已更新"
echo ""

# 2. 等待几秒确保密码生效
echo "2. 等待密码生效（5秒）..."
sleep 5

# 3. 更新 Container App 环境变量
echo "3. 更新 Container App 环境变量..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "DB_PASSWORD=$NEW_PASSWORD" \
  --output none

echo "✅ Container App 环境变量已更新"
echo ""

# 4. 检查防火墙规则
echo "4. 检查 PostgreSQL 防火墙规则..."
ALLOW_AZURE=$(az postgres flexible-server firewall-rule list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query "[?startIpAddress=='0.0.0.0' && endIpAddress=='0.0.0.0'].name" -o tsv 2>/dev/null || echo "")

if [ -z "$ALLOW_AZURE" ]; then
    echo "⚠️  未找到允许 Azure 服务的防火墙规则，正在添加..."
    az postgres flexible-server firewall-rule create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$POSTGRES_NAME" \
      --rule-name AllowAzureServices \
      --start-ip-address 0.0.0.0 \
      --end-ip-address 0.0.0.0 \
      --output none
    
    echo "✅ 防火墙规则已添加"
else
    echo "✅ 防火墙规则已存在: $ALLOW_AZURE"
fi

echo ""

# 5. 等待 Container App 重启
echo "5. 等待 Container App 重启（30秒）..."
sleep 30

# 6. 测试健康检查
echo ""
echo "6. 测试健康检查..."
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

for i in {1..3}; do
    echo "   尝试 $i/3..."
    RESPONSE=$(curl -s --max-time 10 "https://$BACKEND_URL/health" 2>&1 || echo "TIMEOUT")
    if echo "$RESPONSE" | grep -q "status"; then
        echo "✅ 健康检查成功！"
        echo "$RESPONSE"
        exit 0
    else
        echo "   ⏳ 等待中..."
        sleep 10
    fi
done

echo ""
echo "⚠️  健康检查仍然失败"
echo ""
echo "请检查："
echo "  1. 在 Azure Portal 中查看 Container App 的 Log stream"
echo "  2. 确认应用是否启动成功"
echo "  3. 查看数据库连接日志"
