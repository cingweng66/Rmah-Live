#!/bin/bash

# 重置开发环境（清理数据库和缓存）

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}⚠️  警告：此操作将清空所有数据！${NC}\n"
read -p "确认重置开发环境？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo -e "${YELLOW}操作已取消${NC}"
  exit 0
fi

echo -e "\n${YELLOW}🔄 重置开发环境...${NC}\n"

# 停止服务
echo -e "${YELLOW}停止服务...${NC}"
pkill -f "nest start" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# 清理数据库
echo -e "${YELLOW}清理数据库...${NC}"
if command -v docker &> /dev/null; then
  docker-compose -f backend/docker-compose.yml down -v
  docker-compose -f backend/docker-compose.yml up -d postgres redis
  sleep 3
else
  echo "请手动清理数据库（需要本地 PostgreSQL）"
fi

# 清理 Redis
echo -e "${YELLOW}清理 Redis 缓存...${NC}"
if command -v redis-cli &> /dev/null; then
  redis-cli -h localhost -p 6379 FLUSHALL 2>/dev/null || true
fi

# 清理本地存储
echo -e "${YELLOW}清理本地存储...${NC}"
rm -rf backend/dist 2>/dev/null || true
rm -rf dist 2>/dev/null || true
rm -rf node_modules/.vite 2>/dev/null || true

# 清理日志
echo -e "${YELLOW}清理日志文件...${NC}"
rm -f backend/npm-debug.log 2>/dev/null || true
rm -f npm-debug.log 2>/dev/null || true

echo -e "\n${GREEN}✅ 开发环境已重置${NC}"
echo -e "${YELLOW}💡 提示: 运行 ./dev-start.sh 重新启动服务${NC}"
