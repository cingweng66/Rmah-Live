#!/bin/bash

# 检查 CORS 配置

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 检查 CORS 配置 ==="
echo ""

# 1. 检查 FRONTEND_URL 环境变量
echo "1. 检查 FRONTEND_URL 环境变量..."
FRONTEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='FRONTEND_URL'].value" -o tsv 2>/dev/null || echo "")

if [ -z "$FRONTEND_URL" ]; then
    echo "❌ FRONTEND_URL 未设置！"
    echo ""
    echo "请运行: ./fix-cors.sh 来设置 FRONTEND_URL"
    exit 1
else
    echo "✅ FRONTEND_URL: $FRONTEND_URL"
fi

echo ""

# 2. 获取后端 URL
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "2. 后端 URL: https://$BACKEND_URL"
echo ""

# 3. 测试 CORS 预检请求
echo "3. 测试 CORS 预检请求（OPTIONS）..."
OPTIONS_RESPONSE=$(curl -s -X OPTIONS \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i "https://$BACKEND_URL/auth/login" 2>&1)

echo "$OPTIONS_RESPONSE" | head -20
echo ""

# 检查关键 CORS 头
if echo "$OPTIONS_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
    echo "✅ 找到 Access-Control-Allow-Origin 头"
    echo "$OPTIONS_RESPONSE" | grep -i "Access-Control-Allow-Origin"
else
    echo "❌ 未找到 Access-Control-Allow-Origin 头"
fi

if echo "$OPTIONS_RESPONSE" | grep -qi "Access-Control-Allow-Methods"; then
    echo "✅ 找到 Access-Control-Allow-Methods 头"
    echo "$OPTIONS_RESPONSE" | grep -i "Access-Control-Allow-Methods"
else
    echo "⚠️  未找到 Access-Control-Allow-Methods 头"
fi

echo ""

# 4. 测试实际请求
echo "4. 测试实际请求（GET /health）..."
GET_RESPONSE=$(curl -s -X GET \
  -H "Origin: $FRONTEND_URL" \
  -i "https://$BACKEND_URL/health" 2>&1)

echo "$GET_RESPONSE" | head -15
echo ""

if echo "$GET_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
    echo "✅ GET 请求包含 CORS 头"
else
    echo "❌ GET 请求缺少 CORS 头"
fi

echo ""
echo "=== 检查完成 ==="
echo ""
echo "如果 CORS 仍然有问题："
echo "  1. 确认前端 URL 与 FRONTEND_URL 完全匹配（包括协议和端口）"
echo "  2. 运行 ./fix-cors.sh 更新 FRONTEND_URL"
echo "  3. 检查后端日志中的 CORS 配置信息"
