#!/bin/bash

# 重新构建并部署后端

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
ACR_NAME="mahjongacr53114"  # 根据你的实际 ACR 名称修改

echo "=== 重新构建并部署后端 ==="
echo ""

# 1. 获取 ACR 信息
echo "1. 获取 ACR 信息..."
ACR_LOGIN_SERVER=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query loginServer -o tsv 2>/dev/null || echo "")

if [ -z "$ACR_LOGIN_SERVER" ]; then
    echo "⚠️  无法找到 ACR，请手动输入 ACR 名称："
    read -p "ACR 名称（例如: mahjongacr53114）: " ACR_NAME
    ACR_LOGIN_SERVER=$(az acr show \
      --resource-group "$RESOURCE_GROUP" \
      --name "$ACR_NAME" \
      --query loginServer -o tsv)
fi

IMAGE_NAME="${ACR_LOGIN_SERVER}/${BACKEND_NAME}:latest"

echo "ACR 登录服务器: $ACR_LOGIN_SERVER"
echo "镜像名称: $IMAGE_NAME"
echo ""

# 2. 登录 ACR
echo "2. 登录 ACR..."
ACR_USERNAME=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query username -o tsv)

ACR_PASSWORD=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query passwords[0].value -o tsv)

echo "$ACR_PASSWORD" | docker login "$ACR_LOGIN_SERVER" -u "$ACR_USERNAME" --password-stdin

# 3. 构建镜像
echo ""
echo "3. 构建 Docker 镜像..."
cd "$(dirname "$0")/backend"
docker build -t "$IMAGE_NAME" .

# 4. 推送镜像
echo ""
echo "4. 推送镜像到 ACR..."
docker push "$IMAGE_NAME"

# 5. 更新 Container App
echo ""
echo "5. 更新 Container App（使用新镜像）..."
cd "$(dirname "$0")"

az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --image "$IMAGE_NAME" \
  --output none

echo "✅ 更新完成"
echo ""

# 6. 等待启动
echo "6. 等待应用启动（30秒）..."
sleep 30

# 7. 测试健康检查
echo ""
echo "7. 测试健康检查..."
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

for i in {1..3}; do
    echo "   尝试 $i/3..."
    RESPONSE=$(curl -s --max-time 10 "https://$BACKEND_URL/health" 2>&1 || echo "TIMEOUT")
    if echo "$RESPONSE" | grep -q "status"; then
        echo "✅ 健康检查成功！"
        echo "$RESPONSE"
        exit 0
    else
        echo "   ⏳ 等待中..."
        sleep 10
    fi
done

echo ""
echo "⚠️  健康检查失败，请查看日志："
echo "  az containerapp logs show -g $RESOURCE_GROUP -n $BACKEND_NAME --tail 50"
