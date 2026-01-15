#!/bin/bash

# Docker 启动脚本

echo "🚀 启动日麻直播记分系统后端（Docker 模式）"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装或未在 PATH 中"
    echo ""
    echo "请选择："
    echo "1. 安装 Docker Desktop: https://www.docker.com/products/docker-desktop"
    echo "2. 或使用本地安装模式: ./start-local.sh"
    echo ""
    echo "macOS 快速安装:"
    echo "   brew install --cask docker"
    echo ""
    exit 1
fi

# 检查 docker compose 命令（新版本使用 docker compose，旧版本使用 docker-compose）
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose version &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Docker Compose 未找到"
    exit 1
fi

echo "✅ 使用命令: $DOCKER_COMPOSE"
echo ""

# 启动数据库和 Redis
echo "📦 启动 PostgreSQL 和 Redis..."
$DOCKER_COMPOSE up -d postgres redis

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
if $DOCKER_COMPOSE ps | grep -q "Up"; then
    echo "✅ 数据库和 Redis 已启动"
else
    echo "❌ 服务启动失败，请检查日志: $DOCKER_COMPOSE logs"
    exit 1
fi

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 启动后端
echo "🚀 启动后端服务..."
npm run start:dev
