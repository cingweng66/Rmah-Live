#!/bin/bash

# 一键启动开发环境脚本
# 自动检测并启动前后端服务

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 启动日麻直播记分系统开发环境${NC}\n"

# 检查是否在项目根目录
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
  echo -e "${RED}❌ 错误：请在项目根目录运行此脚本${NC}"
  echo -e "${YELLOW}💡 提示：${NC}"
  echo -e "  当前目录: $(pwd)"
  echo -e "  请先切换到项目目录："
  echo -e "  ${GREEN}cd \"$(dirname "$0" 2>/dev/null || echo '/Users/anthonyleung/Downloads/日麻直播记分系统 (1)')\"${NC}"
  echo -e "  或者："
  echo -e "  ${GREEN}cd ~/Downloads/日麻直播记分系统\\ \\(1\\)${NC}"
  exit 1
fi

# 检查并创建 .env 文件
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}📝 创建前端 .env 文件...${NC}"
  cat > .env << EOF
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
EOF
  echo -e "${GREEN}✅ 前端 .env 文件已创建${NC}"
fi

# 检查并创建后端 .env 文件
if [ ! -f "backend/.env" ]; then
  echo -e "${YELLOW}📝 创建后端 .env 文件...${NC}"
  cat > backend/.env << EOF
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=mahjong_db

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# 应用配置
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
EOF
  echo -e "${GREEN}✅ 后端 .env 文件已创建${NC}"
fi

# 检查依赖
echo -e "\n${YELLOW}📦 检查依赖...${NC}"

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}   安装前端依赖...${NC}"
  npm install
fi

if [ ! -d "backend/node_modules" ]; then
  echo -e "${YELLOW}   安装后端依赖...${NC}"
  cd backend && npm install && cd ..
fi

# 启动后端
echo -e "\n${GREEN}🔧 启动后端服务...${NC}"
cd backend

# 检查 Docker
if command -v docker &> /dev/null && docker ps > /dev/null 2>&1; then
  echo -e "${YELLOW}   检测到 Docker，使用 Docker 模式...${NC}"
  
  # 确保 Docker 容器运行
  if ! docker ps | grep -q mahjong-postgres; then
    echo -e "${YELLOW}   启动 PostgreSQL 容器...${NC}"
    docker-compose up -d postgres 2>/dev/null || docker compose up -d postgres 2>/dev/null
  fi
  
  if ! docker ps | grep -q mahjong-redis; then
    echo -e "${YELLOW}   启动 Redis 容器...${NC}"
    docker-compose up -d redis 2>/dev/null || docker compose up -d redis 2>/dev/null
  fi
  
  # 等待 Redis 就绪
  echo -e "${YELLOW}   等待 Redis 就绪...${NC}"
  for i in {1..30}; do
    if docker exec mahjong-redis redis-cli ping > /dev/null 2>&1; then
      echo -e "${GREEN}   ✅ Redis 已就绪${NC}"
      break
    fi
    if [ $i -eq 30 ]; then
      echo -e "${RED}   ❌ Redis 启动超时${NC}"
    fi
    sleep 1
  done
  
  # 等待 PostgreSQL 就绪
  echo -e "${YELLOW}   等待 PostgreSQL 就绪...${NC}"
  for i in {1..30}; do
    if docker exec mahjong-postgres pg_isready -U postgres > /dev/null 2>&1; then
      echo -e "${GREEN}   ✅ PostgreSQL 已就绪${NC}"
      break
    fi
    if [ $i -eq 30 ]; then
      echo -e "${RED}   ❌ PostgreSQL 启动超时${NC}"
    fi
    sleep 1
  done
  
  # Docker 模式下直接启动后端（数据库已在容器中）
  echo -e "${YELLOW}   启动后端应用（连接 Docker 数据库）...${NC}"
  
  # 检查环境变量文件
  if [ ! -f ".env" ]; then
    echo -e "${YELLOW}   创建 .env 文件...${NC}"
    cat > .env << EOF
# 数据库配置（Docker 模式）
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=mahjong_db

# Redis 配置（Docker 模式）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# 应用配置
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
EOF
  fi
  
  # 安装依赖（如果需要）
  if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   安装后端依赖...${NC}"
    npm install
  fi
  
  # 直接启动后端
  npm run start:dev &
  BACKEND_PID=$!
else
  echo -e "${YELLOW}   使用本地模式...${NC}"
  ./start-local.sh &
  BACKEND_PID=$!
fi

cd ..

# 等待后端启动
echo -e "${YELLOW}   等待后端服务启动...${NC}"
sleep 8

# 检查后端是否启动成功
for i in {1..30}; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务已启动 (http://localhost:3000)${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ 后端服务启动失败，请检查日志${NC}"
    exit 1
  fi
  sleep 1
done

# 启动前端
echo -e "\n${GREEN}🎨 启动前端服务...${NC}"
npm run dev &
FRONTEND_PID=$!

# 等待前端启动
sleep 3

echo -e "\n${GREEN}✨ 开发环境启动完成！${NC}\n"
echo -e "${GREEN}📱 前端地址: ${NC}http://localhost:8080"
echo -e "${GREEN}🔧 后端地址: ${NC}http://localhost:3000"
echo -e "${GREEN}📡 API 文档: ${NC}http://localhost:3000/game"
echo -e "\n${YELLOW}💡 提示:${NC}"
echo -e "   - 按 Ctrl+C 停止所有服务"
echo -e "   - 查看日志: ./dev-logs.sh"
echo -e "   - 健康检查: ./dev-check.sh"
echo -e "\n${GREEN}🎮 开始开发吧！${NC}\n"

# 等待用户中断
trap "echo -e '\n${YELLOW}🛑 正在停止服务...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
