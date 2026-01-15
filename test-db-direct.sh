#!/bin/bash

# 直接测试数据库连接

RESOURCE_GROUP="mahjong-live"
POSTGRES_NAME="mahjong-postgres-50831"
DB_PASSWORD="4I6RJOUWy5m8W2Uh"

echo "=== 直接测试数据库连接 ==="
echo ""

# 获取数据库地址
DB_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query fullyQualifiedDomainName -o tsv)

echo "数据库地址: $DB_HOST"
echo ""

# 检查是否安装了 psql
if command -v psql &> /dev/null; then
    echo "使用 psql 测试连接..."
    PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" \
      -U postgres \
      -d mahjong_db \
      -c "SELECT version();" 2>&1 | head -10
elif command -v docker &> /dev/null; then
    echo "使用 Docker 测试连接..."
    # 使用环境变量传递密码，避免 URL 编码问题
    docker run --rm \
      -e PGPASSWORD="${DB_PASSWORD}" \
      postgres:15-alpine \
      psql -h "${DB_HOST}" -U postgres -d mahjong_db -c "SELECT version();" 2>&1 | head -10
else
    echo "❌ 需要安装 psql 或 Docker 来测试连接"
    echo ""
    echo "macOS 安装 psql:"
    echo "  brew install postgresql"
fi

echo ""
echo "如果连接失败，可能的原因："
echo "  1. 防火墙规则未允许您的 IP"
echo "  2. 数据库密码错误"
echo "  3. 网络问题"
