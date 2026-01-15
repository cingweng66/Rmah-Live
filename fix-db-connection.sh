#!/bin/bash

# 修复数据库连接问题

set -e

RESOURCE_GROUP="mahjong-live"
POSTGRES_NAME="mahjong-postgres-50831"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 修复数据库连接问题 ==="
echo ""

# 1. 获取数据库信息
echo "1. 获取数据库信息..."
DB_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query fullyQualifiedDomainName -o tsv 2>/dev/null || echo "")

if [ -z "$DB_HOST" ]; then
    echo "❌ 无法获取数据库信息，请检查 PostgreSQL 服务器是否存在"
    exit 1
fi

echo "   数据库地址: $DB_HOST"
echo ""

# 2. 检查并修复防火墙规则
echo "2. 检查 PostgreSQL 防火墙规则..."
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
    sleep 5
else
    echo "✅ 防火墙规则已存在: $ALLOW_AZURE"
fi

echo ""

# 3. 检查数据库连接设置
echo "3. 检查数据库连接设置..."
PUBLIC_ACCESS=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query "network.publicNetworkAccess" -o tsv 2>/dev/null || echo "")

echo "   公共网络访问: ${PUBLIC_ACCESS:-未设置}"

if [ "$PUBLIC_ACCESS" != "Enabled" ]; then
    echo "⚠️  公共网络访问未启用，正在启用..."
    az postgres flexible-server update \
      --resource-group "$RESOURCE_GROUP" \
      --name "$POSTGRES_NAME" \
      --public-network-access Enabled \
      --output none
    
    echo "✅ 公共网络访问已启用"
    sleep 5
else
    echo "✅ 公共网络访问已启用"
fi

echo ""

# 4. 获取 Container App 的数据库密码
echo "4. 检查 Container App 环境变量..."
DB_PASSWORD=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_PASSWORD'].value" -o tsv 2>/dev/null || echo "")

if [ -z "$DB_PASSWORD" ]; then
    echo "⚠️  Container App 中未找到 DB_PASSWORD"
    read -sp "请输入数据库密码: " DB_PASSWORD
    echo ""
    echo ""
    
    # 更新 Container App 环境变量
    echo "   更新 Container App 环境变量..."
    az containerapp update \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --set-env-vars "DB_PASSWORD=$DB_PASSWORD" \
      --output none
    
    echo "✅ 环境变量已更新"
else
    echo "✅ 找到 DB_PASSWORD（已设置）"
fi

echo ""

# 5. 测试数据库连接（使用 Docker）
echo "5. 测试数据库连接..."
if command -v docker &> /dev/null; then
    echo "   使用 Docker 测试连接..."
    # 使用环境变量传递密码，避免 URL 编码问题
    CONNECTION_TEST=$(docker run --rm \
      -e PGPASSWORD="${DB_PASSWORD}" \
      postgres:15-alpine \
      psql -h "${DB_HOST}" -U postgres -d mahjong_db -c "SELECT version();" 2>&1 | head -10 || echo "FAILED")
    
    if echo "$CONNECTION_TEST" | grep -q "PostgreSQL\|version"; then
        echo "✅ 数据库连接成功！"
        echo "$CONNECTION_TEST" | head -3
    else
        echo "❌ 数据库连接失败"
        echo "   错误信息: $CONNECTION_TEST"
        echo ""
        echo "   可能的原因："
        echo "   1. 密码不正确"
        echo "   2. 数据库服务器未运行"
        echo "   3. 网络问题"
        echo "   4. 防火墙规则未正确配置"
        echo ""
        echo "   请检查："
        echo "   - 在 Azure Portal 中确认数据库服务器状态为 'Running'"
        echo "   - 确认密码是否正确"
        echo "   - 运行 ./check-postgres-firewall.sh 检查防火墙规则"
    fi
else
    echo "⚠️  Docker 未安装，跳过连接测试"
    echo "   建议安装 Docker 或使用 Azure Portal 测试连接"
fi

echo ""

# 6. 检查 Container App 的数据库配置
echo "6. 检查 Container App 数据库配置..."
DB_CONFIG=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_HOST' || name=='DB_PORT' || name=='DB_USERNAME' || name=='DB_DATABASE'].{Name:name, Value:value}" \
  -o table 2>/dev/null || echo "")

echo "$DB_CONFIG"
echo ""

# 7. 触发 Container App 重启
echo "7. 触发 Container App 重启以应用更改..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "RESTART_TRIGGER=$(date +%s)" \
  --output none

echo "✅ 重启已触发"
echo ""

# 8. 等待并测试健康检查
echo "8. 等待应用重启（60秒）..."
sleep 60

echo ""
echo "9. 测试健康检查..."
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
        echo "🎉 数据库连接问题已修复！"
        exit 0
    else
        echo "   ⏳ 等待中... ($RESPONSE)"
        sleep 10
    fi
done

echo ""
echo "⚠️  健康检查仍然失败"
echo ""
echo "请运行以下命令查看详细日志："
echo "  ./check-logs.sh"
echo ""
echo "或在 Azure Portal 中查看 Container App 的 Log stream"
