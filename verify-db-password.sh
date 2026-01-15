#!/bin/bash

# 验证并更新 Container App 的数据库密码

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
POSTGRES_NAME="mahjong-postgres-50831"

echo "=== 验证数据库密码配置 ==="
echo ""

# 1. 获取当前 Container App 的密码
echo "1. 检查 Container App 中的 DB_PASSWORD..."
CURRENT_PASSWORD=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_PASSWORD'].value" -o tsv 2>/dev/null || echo "")

if [ -z "$CURRENT_PASSWORD" ]; then
    echo "⚠️  Container App 中未找到 DB_PASSWORD"
    CURRENT_PASSWORD="未设置"
else
    echo "✅ 找到 DB_PASSWORD（已设置，长度: ${#CURRENT_PASSWORD} 字符）"
fi

echo ""

# 2. 提示输入正确的密码
echo "2. 请输入正确的数据库密码（在 Azure Portal 中设置的密码）"
read -sp "数据库密码: " NEW_PASSWORD
echo ""
echo ""

# 3. 更新 Container App 环境变量
echo "3. 更新 Container App 环境变量..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "DB_PASSWORD=$NEW_PASSWORD" \
  --output none

echo "✅ Container App 环境变量已更新"
echo ""

# 4. 获取数据库地址
DB_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query fullyQualifiedDomainName -o tsv 2>/dev/null || echo "")

if [ -z "$DB_HOST" ]; then
    echo "❌ 无法获取数据库地址"
    exit 1
fi

echo "4. 测试数据库连接..."
echo "   数据库地址: $DB_HOST"
echo ""

# 5. 使用 Docker 测试连接（使用环境变量，避免 URL 编码问题）
if command -v docker &> /dev/null; then
    echo "   使用 Docker 测试连接..."
    CONNECTION_TEST=$(docker run --rm \
      -e PGPASSWORD="${NEW_PASSWORD}" \
      postgres:15-alpine \
      psql -h "${DB_HOST}" -U postgres -d mahjong_db -c "SELECT version();" 2>&1 | head -10 || echo "FAILED")
    
    if echo "$CONNECTION_TEST" | grep -q "PostgreSQL\|version"; then
        echo "✅ 数据库连接成功！"
        echo "$CONNECTION_TEST" | head -3
        echo ""
        echo "🎉 密码配置正确！"
    else
        echo "❌ 数据库连接失败"
        echo "   错误信息: $CONNECTION_TEST"
        echo ""
        echo "   可能的原因："
        echo "   1. 密码不正确"
        echo "   2. 防火墙规则未配置"
        echo "   3. 公共网络访问未启用"
        echo ""
        echo "   请运行: ./check-postgres-firewall.sh"
    fi
else
    echo "⚠️  Docker 未安装，跳过连接测试"
fi

echo ""

# 6. 等待 Container App 重启
echo "5. 等待 Container App 重启（30秒）..."
sleep 30

# 7. 测试健康检查
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
        echo "🎉 数据库连接问题已解决！"
        exit 0
    else
        echo "   ⏳ 等待中... ($RESPONSE)"
        sleep 10
    fi
done

echo ""
echo "⚠️  健康检查仍然失败"
echo ""
echo "请运行: ./check-logs.sh 查看应用日志"
