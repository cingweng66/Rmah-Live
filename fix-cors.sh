#!/bin/bash

# 修复 CORS 配置

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 修复 CORS 配置 ==="
echo ""

# 1. 检查当前的 FRONTEND_URL
echo "1. 检查当前的 FRONTEND_URL 环境变量..."
CURRENT_FRONTEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='FRONTEND_URL'].value" -o tsv 2>/dev/null || echo "")

if [ -z "$CURRENT_FRONTEND_URL" ]; then
    echo "⚠️  FRONTEND_URL 未设置"
else
    echo "   当前值: $CURRENT_FRONTEND_URL"
fi

echo ""

# 2. 获取前端 URL
echo "2. 请输入前端 URL（Storage Account 的静态网站 URL）"
echo "   例如: https://mahjongweb8472536.z13.web.core.windows.net"
read -p "前端 URL: " FRONTEND_URL

if [ -z "$FRONTEND_URL" ]; then
    echo "❌ 前端 URL 不能为空"
    exit 1
fi

# 确保 URL 以 https:// 或 http:// 开头
if [[ ! "$FRONTEND_URL" =~ ^https?:// ]]; then
    FRONTEND_URL="https://$FRONTEND_URL"
fi

# 移除尾部斜杠
FRONTEND_URL="${FRONTEND_URL%/}"

echo ""
echo "   将设置 FRONTEND_URL 为: $FRONTEND_URL"
echo ""

# 3. 更新 Container App 环境变量
echo "3. 更新 Container App 环境变量..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "FRONTEND_URL=$FRONTEND_URL" \
  --output none

echo "✅ FRONTEND_URL 已更新"
echo ""

# 4. 等待 Container App 重启
echo "4. 等待 Container App 重启（30秒）..."
sleep 30

# 5. 测试 CORS
echo ""
echo "5. 测试 CORS 配置..."
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "   后端 URL: https://$BACKEND_URL"
echo "   前端 URL: $FRONTEND_URL"
echo ""

# 测试 OPTIONS 预检请求
echo "   测试 OPTIONS 预检请求..."
OPTIONS_RESPONSE=$(curl -s -X OPTIONS \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v "https://$BACKEND_URL/auth/login" 2>&1)

if echo "$OPTIONS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo "✅ CORS 预检请求成功"
    echo "$OPTIONS_RESPONSE" | grep -i "access-control" | head -5
else
    echo "⚠️  CORS 预检请求可能有问题"
    echo "$OPTIONS_RESPONSE" | grep -E "HTTP|access-control" | head -10
fi

echo ""
echo "=== 修复完成 ==="
echo ""
echo "如果 CORS 仍然有问题，请："
echo "  1. 确认前端 URL 是否正确（包括协议 https://）"
echo "  2. 检查浏览器控制台的完整错误信息"
echo "  3. 运行 ./check-logs.sh 查看后端日志中的 CORS 配置"
