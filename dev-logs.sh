#!/bin/bash

# 查看开发环境日志

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}📋 开发环境日志查看器${NC}\n"
echo -e "${YELLOW}选择要查看的日志:${NC}"
echo "1) 后端日志 (NestJS)"
echo "2) 前端日志 (Vite)"
echo "3) 数据库日志 (PostgreSQL)"
echo "4) Redis 日志"
echo "5) 所有日志 (合并显示)"
echo "6) Docker 容器日志"
echo ""
read -p "请选择 (1-6): " choice

case $choice in
  1)
    echo -e "${GREEN}查看后端日志...${NC}"
    if [ -f "backend/npm-debug.log" ]; then
      tail -f backend/npm-debug.log
    else
      echo "后端日志文件不存在，请先启动后端服务"
    fi
    ;;
  2)
    echo -e "${GREEN}查看前端日志...${NC}"
    if [ -f "npm-debug.log" ]; then
      tail -f npm-debug.log
    else
      echo "前端日志文件不存在，请先启动前端服务"
    fi
    ;;
  3)
    echo -e "${GREEN}查看数据库日志...${NC}"
    if command -v docker &> /dev/null; then
      docker logs -f $(docker ps -q -f name=postgres) 2>/dev/null || echo "PostgreSQL 容器未运行"
    else
      echo "请使用 Docker 模式查看数据库日志，或查看系统日志"
    fi
    ;;
  4)
    echo -e "${GREEN}查看 Redis 日志...${NC}"
    if command -v docker &> /dev/null; then
      docker logs -f $(docker ps -q -f name=redis) 2>/dev/null || echo "Redis 容器未运行"
    else
      echo "请使用 Docker 模式查看 Redis 日志，或查看系统日志"
    fi
    ;;
  5)
    echo -e "${GREEN}查看所有日志 (按 Ctrl+C 退出)...${NC}"
    tail -f backend/npm-debug.log npm-debug.log 2>/dev/null || echo "日志文件不存在"
    ;;
  6)
    echo -e "${GREEN}查看 Docker 容器日志...${NC}"
    if command -v docker &> /dev/null; then
      docker-compose -f backend/docker-compose.yml logs -f
    else
      echo "Docker 未安装或未运行"
    fi
    ;;
  *)
    echo "无效选择"
    ;;
esac
