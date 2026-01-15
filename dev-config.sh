#!/bin/bash

# 配置管理工具

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}⚙️  配置管理工具${NC}\n"
echo -e "${YELLOW}选择操作:${NC}"
echo "1) 查看当前配置"
echo "2) 重置配置文件"
echo "3) 生成生产环境配置"
echo "4) 检查配置完整性"
echo ""
read -p "请选择 (1-4): " choice

case $choice in
  1)
    echo -e "\n${GREEN}📋 当前配置:${NC}\n"
    
    echo -e "${YELLOW}前端配置 (.env):${NC}"
    if [ -f ".env" ]; then
      cat .env
    else
      echo "  文件不存在"
    fi
    
    echo -e "\n${YELLOW}后端配置 (backend/.env):${NC}"
    if [ -f "backend/.env" ]; then
      cat backend/.env | grep -v "PASSWORD\|SECRET" | sed 's/^/  /'
    else
      echo "  文件不存在"
    fi
    ;;
  2)
    echo -e "\n${YELLOW}重置配置文件...${NC}"
    rm -f .env backend/.env
    echo -e "${GREEN}✅ 配置文件已删除${NC}"
    echo -e "${YELLOW}💡 提示: 运行 ./dev-start.sh 会自动重新创建${NC}"
    ;;
  3)
    echo -e "\n${YELLOW}生成生产环境配置...${NC}"
    
    read -p "数据库主机: " db_host
    read -p "数据库端口 [5432]: " db_port
    db_port=${db_port:-5432}
    read -p "数据库用户名: " db_user
    read -sp "数据库密码: " db_pass
    echo ""
    read -p "数据库名称: " db_name
    
    read -p "Redis 主机 [localhost]: " redis_host
    redis_host=${redis_host:-localhost}
    read -p "Redis 端口 [6379]: " redis_port
    redis_port=${redis_port:-6379}
    read -sp "Redis 密码 (可选，直接回车跳过): " redis_pass
    echo ""
    
    read -p "JWT 密钥 (留空自动生成): " jwt_secret
    if [ -z "$jwt_secret" ]; then
      jwt_secret=$(openssl rand -hex 32)
    fi
    
    read -p "前端 URL [http://localhost:8080]: " frontend_url
    frontend_url=${frontend_url:-http://localhost:8080}
    
    cat > backend/.env.production << EOF
# 生产环境配置
NODE_ENV=production
PORT=3000
FRONTEND_URL=${frontend_url}

# 数据库配置
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_USERNAME=${db_user}
DB_PASSWORD=${db_pass}
DB_DATABASE=${db_name}

# Redis 配置
REDIS_HOST=${redis_host}
REDIS_PORT=${redis_port}
REDIS_PASSWORD=${redis_pass}

# JWT 配置
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=7d
EOF
    
    echo -e "\n${GREEN}✅ 生产环境配置已生成: backend/.env.production${NC}"
    ;;
  4)
    echo -e "\n${YELLOW}检查配置完整性...${NC}\n"
    
    errors=0
    
    # 检查前端配置
    if [ ! -f ".env" ]; then
      echo -e "${RED}❌ 前端 .env 文件不存在${NC}"
      errors=$((errors+1))
    else
      if ! grep -q "VITE_API_URL" .env; then
        echo -e "${RED}❌ 前端配置缺少 VITE_API_URL${NC}"
        errors=$((errors+1))
      else
        echo -e "${GREEN}✅ 前端配置完整${NC}"
      fi
    fi
    
    # 检查后端配置
    if [ ! -f "backend/.env" ]; then
      echo -e "${RED}❌ 后端 .env 文件不存在${NC}"
      errors=$((errors+1))
    else
      required_vars=("DB_HOST" "DB_PORT" "DB_USERNAME" "DB_PASSWORD" "DB_DATABASE" "JWT_SECRET")
      for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" backend/.env; then
          echo -e "${RED}❌ 后端配置缺少 ${var}${NC}"
          errors=$((errors+1))
        fi
      done
      
      if [ $errors -eq 0 ]; then
        echo -e "${GREEN}✅ 后端配置完整${NC}"
      fi
    fi
    
    if [ $errors -eq 0 ]; then
      echo -e "\n${GREEN}✅ 所有配置完整${NC}"
    else
      echo -e "\n${RED}❌ 发现 ${errors} 个配置问题${NC}"
    fi
    ;;
  *)
    echo "无效选择"
    ;;
esac
