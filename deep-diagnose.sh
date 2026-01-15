#!/bin/bash

# 深度诊断脚本

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
POSTGRES_NAME="mahjong-postgres-50831"

echo "=== 深度诊断 ==="
echo ""

# 1. 检查 Container App 配置
echo "1. 检查 Container App 配置..."
az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "{
    Image:properties.template.containers[0].image,
    Port:properties.template.containers[0].ports[0].containerPort,
    TargetPort:properties.configuration.ingress.targetPort,
    IngressEnabled:properties.configuration.ingress.external,
    MinReplicas:properties.template.scale.minReplicas,
    RunningStatus:properties.runningStatus
  }" -o table

echo ""

# 2. 检查环境变量（特别是数据库）
echo "2. 检查关键环境变量..."
az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_HOST' || name=='DB_PASSWORD' || name=='PORT' || name=='NODE_ENV'].{Name:name, Value:value}" \
  -o table

echo ""

# 3. 测试数据库连接（从本地）
echo "3. 测试数据库连接..."
DB_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query fullyQualifiedDomainName -o tsv)

DB_PASSWORD=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_PASSWORD'].value" -o tsv)

echo "数据库地址: $DB_HOST"
echo "测试连接..."

# 使用 Docker 测试数据库连接
if command -v docker &> /dev/null; then
    echo "使用 Docker 测试数据库连接..."
    # 使用环境变量传递密码，避免 URL 编码问题
    docker run --rm \
      -e PGPASSWORD="${DB_PASSWORD}" \
      postgres:15-alpine \
      psql -h "${DB_HOST}" -U postgres -d mahjong_db -c "SELECT version();" 2>&1 | head -10 || echo "❌ 数据库连接失败"
else
    echo "⚠️  Docker 未安装，无法测试数据库连接"
    echo "   请手动测试或安装 Docker"
fi

echo ""

# 4. 检查 PostgreSQL 防火墙
echo "4. 检查 PostgreSQL 防火墙规则..."
FIREWALL_RULES=$(az postgres flexible-server firewall-rule list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query "[].{Name:name, StartIP:startIpAddress, EndIP:endIpAddress}" \
  -o table 2>/dev/null || echo "无法获取防火墙规则")

echo "$FIREWALL_RULES"
echo ""

# 检查是否有允许 Azure 服务的规则
ALLOW_AZURE=$(az postgres flexible-server firewall-rule list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query "[?startIpAddress=='0.0.0.0' && endIpAddress=='0.0.0.0'].name" -o tsv 2>/dev/null || echo "")

if [ -z "$ALLOW_AZURE" ]; then
    echo "⚠️  未找到允许 Azure 服务的防火墙规则！"
    echo "   这可能是问题所在！"
    echo ""
    echo "   添加防火墙规则："
    echo "   az postgres flexible-server firewall-rule create \\"
    echo "     --resource-group $RESOURCE_GROUP \\"
    echo "     --name $POSTGRES_NAME \\"
    echo "     --rule-name AllowAzureServices \\"
    echo "     --start-ip-address 0.0.0.0 \\"
    echo "     --end-ip-address 0.0.0.0"
else
    echo "✅ 已存在允许 Azure 服务的规则"
fi

echo ""

# 5. 检查应用是否真的在监听端口
echo "5. 检查应用端口监听..."
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "后端 URL: https://$BACKEND_URL"
echo ""

echo "测试不同端点："
echo "  - 根路径:"
curl -v --max-time 5 "https://$BACKEND_URL/" 2>&1 | grep -E "HTTP|status|error" | head -5 || echo "  超时或失败"

echo ""
echo "  - /health:"
curl -v --max-time 5 "https://$BACKEND_URL/health" 2>&1 | grep -E "HTTP|status|error" | head -5 || echo "  超时或失败"

echo ""
echo "  - /auth:"
curl -v --max-time 5 "https://$BACKEND_URL/auth" 2>&1 | grep -E "HTTP|status|error" | head -5 || echo "  超时或失败"

echo ""
echo "=== 诊断完成 ==="
echo ""
echo "如果所有请求都超时，可能的原因："
echo "  1. 应用没有启动（数据库连接失败导致崩溃）"
echo "  2. 应用没有监听端口 3000"
echo "  3. Ingress 配置有问题"
echo ""
echo "建议："
echo "  1. 在 Azure Portal 中查看 Log stream"
echo "  2. 检查数据库防火墙规则"
echo "  3. 验证环境变量是否正确"
