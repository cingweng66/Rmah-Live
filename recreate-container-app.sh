#!/bin/bash

# 重新创建 Container App（如果 registry 配置无法修复）

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
ACR_NAME="mahjongacr53114"
CONTAINER_ENV_NAME="mahjong-env-53114"

echo "=== 重新创建 Container App ==="
echo ""
echo "⚠️  警告：这将删除并重新创建 Container App"
echo "   所有环境变量和配置需要重新设置"
echo ""
read -p "是否继续？(y/n，默认 n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

echo ""

# 1. 获取配置信息
echo "1. 获取配置信息..."
ACR_LOGIN_SERVER=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query loginServer -o tsv)

ACR_USERNAME=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query username -o tsv)

ACR_PASSWORD=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query passwords[0].value -o tsv)

DB_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "mahjong-postgres-50831" \
  --query fullyQualifiedDomainName -o tsv)

DB_PASSWORD=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_PASSWORD'].value" -o tsv 2>/dev/null || echo "")

if [ -z "$DB_PASSWORD" ]; then
    read -sp "请输入数据库密码: " DB_PASSWORD
    echo ""
fi

JWT_SECRET=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='JWT_SECRET'].value" -o tsv 2>/dev/null || echo "")

if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "生成新的 JWT_SECRET"
fi

FRONTEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='FRONTEND_URL'].value" -o tsv 2>/dev/null || echo "https://placeholder.frontend.url")

IMAGE_NAME="$ACR_LOGIN_SERVER/mahjong-backend-53114:latest"

echo "   镜像: $IMAGE_NAME"
echo "   数据库: $DB_HOST"
echo ""

# 2. 删除现有的 Container App
echo "2. 删除现有的 Container App..."
az containerapp delete \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --yes \
  --output none

echo "✅ Container App 已删除"
echo ""

# 3. 等待删除完成
echo "3. 等待删除完成（30秒）..."
sleep 30

# 4. 创建新的 Container App
echo "4. 创建新的 Container App..."
ENV_VARS="NODE_ENV=production PORT=3000 DB_HOST=$DB_HOST DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=$DB_PASSWORD DB_DATABASE=mahjong_db JWT_SECRET=$JWT_SECRET JWT_EXPIRES_IN=7d FRONTEND_URL=$FRONTEND_URL"

az containerapp create \
  --name "$BACKEND_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_ENV_NAME" \
  --image "$IMAGE_NAME" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars $ENV_VARS \
  --output none

echo "✅ Container App 已创建"
echo ""

# 5. 等待启动
echo "5. 等待应用启动（60秒）..."
sleep 60

# 6. 测试健康检查
echo ""
echo "6. 测试健康检查..."
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "   后端 URL: https://$BACKEND_URL"
echo ""

for i in {1..5}; do
    echo "   尝试 $i/5..."
    RESPONSE=$(curl -s --max-time 10 "https://$BACKEND_URL/health" 2>&1 || echo "TIMEOUT")
    if echo "$RESPONSE" | grep -q "status\|ok\|healthy"; then
        echo ""
        echo "✅ 健康检查成功！"
        echo "   响应: $RESPONSE"
        echo ""
        echo "🎉 Container App 已成功重新创建！"
        exit 0
    else
        echo "   ⏳ 等待中... ($RESPONSE)"
        sleep 15
    fi
done

echo ""
echo "⚠️  健康检查仍然失败"
echo ""
echo "请检查："
echo "  1. 运行 ./check-logs.sh 查看详细日志"
echo "  2. 在 Azure Portal 中查看 Container App 的状态"
