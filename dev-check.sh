#!/bin/bash

# 开发环境健康检查脚本

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔍 检查开发环境状态...${NC}\n"

# 检查后端
echo -e "${YELLOW}检查后端服务...${NC}"
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 后端服务运行正常 (http://localhost:3000)${NC}"
  
  # 检查 API 端点
  echo -e "${YELLOW}   检查 API 端点...${NC}"
  if curl -s http://localhost:3000/game > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ API 端点正常${NC}"
  else
    echo -e "${RED}   ❌ API 端点异常${NC}"
  fi
else
  echo -e "${RED}❌ 后端服务未运行${NC}"
fi

# 检查前端
echo -e "\n${YELLOW}检查前端服务...${NC}"
if curl -s http://localhost:8080 > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 前端服务运行正常 (http://localhost:8080)${NC}"
else
  echo -e "${RED}❌ 前端服务未运行${NC}"
fi

# 检查数据库
echo -e "\n${YELLOW}检查数据库连接...${NC}"
if command -v docker &> /dev/null; then
  if docker ps | grep -q postgres; then
    echo -e "${GREEN}✅ PostgreSQL 容器运行中${NC}"
  else
    echo -e "${RED}❌ PostgreSQL 容器未运行${NC}"
  fi
else
  if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL 服务运行正常${NC}"
  else
    echo -e "${RED}❌ PostgreSQL 服务未运行${NC}"
  fi
fi

# 检查 Redis
echo -e "\n${YELLOW}检查 Redis 连接...${NC}"
if command -v docker &> /dev/null; then
  if docker ps | grep -q redis; then
    echo -e "${GREEN}✅ Redis 容器运行中${NC}"
  else
    echo -e "${RED}❌ Redis 容器未运行${NC}"
  fi
else
  if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis 服务运行正常${NC}"
  else
    echo -e "${RED}❌ Redis 服务未运行${NC}"
  fi
fi

echo -e "\n${GREEN}检查完成！${NC}"
