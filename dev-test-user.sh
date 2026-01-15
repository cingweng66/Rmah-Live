#!/bin/bash

# 快速创建测试用户

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}👤 创建测试用户${NC}\n"

# 检查后端是否运行
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo -e "${RED}❌ 后端服务未运行，请先启动后端${NC}"
  exit 1
fi

# 默认测试用户信息
EMAIL="${1:-test@example.com}"
PASSWORD="${2:-test123}"
NAME="${3:-测试用户}"

echo -e "${YELLOW}创建用户:${NC}"
echo -e "  邮箱: ${EMAIL}"
echo -e "  密码: ${PASSWORD}"
echo -e "  姓名: ${NAME}"
echo ""

# 注册用户
RESPONSE=$(curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"name\": \"${NAME}\"
  }")

if echo "$RESPONSE" | grep -q "accessToken"; then
  echo -e "${GREEN}✅ 用户创建成功！${NC}\n"
  echo -e "${GREEN}登录信息:${NC}"
  echo -e "  邮箱: ${EMAIL}"
  echo -e "  密码: ${PASSWORD}"
  echo -e "\n${YELLOW}💡 提示: 系统已自动创建并激活 License${NC}"
else
  if echo "$RESPONSE" | grep -q "already exists"; then
    echo -e "${YELLOW}⚠️  用户已存在，尝试登录...${NC}"
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"${EMAIL}\",
        \"password\": \"${PASSWORD}\"
      }")
    
    if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
      echo -e "${GREEN}✅ 登录成功！${NC}"
    else
      echo -e "${RED}❌ 登录失败: ${LOGIN_RESPONSE}${NC}"
    fi
  else
    echo -e "${RED}❌ 创建失败: ${RESPONSE}${NC}"
  fi
fi
