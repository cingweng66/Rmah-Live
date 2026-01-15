#!/bin/bash

# 本地构建并部署后端（使用镜像加速）

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
ACR_NAME="mahjongacr53114"

echo "=== 本地构建并部署后端 ==="
echo ""

# 1. 获取 ACR 信息
echo "1. 获取 ACR 信息..."
ACR_LOGIN_SERVER=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query loginServer -o tsv)

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

# 3. 检查 Docker 是否运行
if ! docker ps &> /dev/null; then
    echo "❌ Docker 未运行，请先启动 Docker Desktop"
    exit 1
fi

# 4. 构建镜像（使用国内镜像加速）
echo ""
echo "3. 构建 Docker 镜像（这可能需要几分钟）..."
echo "   提示：如果网络慢，可以配置 Docker 镜像加速器"
cd "$(dirname "$0")/backend"

# 尝试使用国内镜像源（如果可用）
docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t "$IMAGE_NAME" . || {
    echo "⚠️  构建失败，尝试使用阿里云镜像..."
    # 如果失败，可以尝试修改 Dockerfile 使用国内镜像
    echo "   请检查网络连接或配置 Docker 镜像加速器"
    exit 1
}

# 5. 推送镜像
echo ""
echo "4. 推送镜像到 ACR..."
docker push "$IMAGE_NAME"

# 6. 更新 Container App
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

# 7. 等待启动
echo "6. 等待应用启动（30秒）..."
sleep 30

# 8. 测试健康检查
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
