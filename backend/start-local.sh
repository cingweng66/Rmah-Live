#!/bin/bash

# 本地开发启动脚本（不使用 Docker）

echo "🚀 启动日麻直播记分系统后端（本地模式）"
echo ""

# 检查 PostgreSQL
echo "📦 检查 PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL 未安装"
    echo ""
    echo "请选择安装方式："
    echo "1. macOS: brew install postgresql@15"
    echo "2. 或使用 Docker（推荐）: 先安装 Docker Desktop"
    echo ""
    echo "如果已安装但找不到命令，请确保 PostgreSQL 在 PATH 中"
    exit 1
fi

# 检查 Redis
echo "📦 检查 Redis..."
if ! command -v redis-server &> /dev/null; then
    echo "❌ Redis 未安装"
    echo ""
    echo "请选择安装方式："
    echo "1. macOS: brew install redis"
    echo "2. 或使用 Docker（推荐）: 先安装 Docker Desktop"
    echo ""
    echo "如果已安装但找不到命令，请确保 Redis 在 PATH 中"
    exit 1
fi

# 启动 PostgreSQL（如果未运行）
echo "📦 检查 PostgreSQL 服务..."
if ! pg_isready -U postgres &> /dev/null; then
    echo "🔄 尝试启动 PostgreSQL..."
    # macOS 使用 brew services
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql@15 2>/dev/null || brew services start postgresql 2>/dev/null || {
            echo "⚠️  无法自动启动 PostgreSQL，请手动启动："
            echo "   brew services start postgresql@15"
            echo "   或: pg_ctl -D /usr/local/var/postgres start"
        }
    else
        echo "⚠️  请手动启动 PostgreSQL 服务"
        echo "   Ubuntu: sudo systemctl start postgresql"
    fi
    sleep 3
fi

# 启动 Redis（如果未运行）
if ! pgrep -x "redis-server" > /dev/null; then
    echo "🔄 启动 Redis..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start redis 2>/dev/null || redis-server --daemonize yes
    else
        redis-server --daemonize yes || sudo systemctl start redis
    fi
    sleep 2
fi

# 检查数据库是否存在
echo "📦 检查数据库..."
DB_EXISTS=$(psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw mahjong_db; echo $?)
if [ "$DB_EXISTS" != "0" ]; then
    echo "📝 创建数据库..."
    psql -U postgres -c "CREATE DATABASE mahjong_db;" 2>/dev/null || {
        echo "⚠️  无法创建数据库，可能权限不足"
        echo "   请手动创建: createdb -U postgres mahjong_db"
    }
else
    echo "✅ 数据库已存在"
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "📝 创建 .env 文件..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件，请检查配置"
fi

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 启动服务
echo ""
echo "🚀 启动后端服务..."
echo "   如果遇到连接错误，请确保："
echo "   1. PostgreSQL 正在运行: pg_isready -U postgres"
echo "   2. Redis 正在运行: redis-cli ping"
echo ""
npm run start:dev
