#!/bin/bash

# 测试数据库连接

DB_HOST="mahjong-postgres-50831.postgres.database.azure.com"
DB_USER="postgres"
DB_PASSWORD="4I6RJOUWy5m8W2Uh"
DB_NAME="mahjong_db"

echo "=== 测试数据库连接 ==="
echo ""

# 检查是否安装了 psql
if ! command -v psql &> /dev/null; then
    echo "⚠️  psql 未安装，使用 Docker 测试..."
    
    if command -v docker &> /dev/null; then
        echo "使用 Docker 测试数据库连接..."
        docker run --rm -it postgres:15-alpine \
          psql "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=require" \
          -c "SELECT version();" 2>&1 | head -10
    else
        echo "❌ 无法测试数据库连接（需要 psql 或 Docker）"
        echo ""
        echo "请手动测试："
        echo "  psql \"postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=require\" -c \"SELECT 1;\""
    fi
else
    echo "使用 psql 测试连接..."
    PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -c "SELECT version();" 2>&1 | head -10
fi

echo ""
echo "如果连接成功，会显示 PostgreSQL 版本信息"
echo "如果连接失败，会显示错误信息"
