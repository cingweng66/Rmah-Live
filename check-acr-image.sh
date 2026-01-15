#!/bin/bash

# 检查 ACR 中的镜像

RESOURCE_GROUP="mahjong-live"
ACR_NAME="mahjongacr53114"
IMAGE_REPO="mahjong-backend-53114"

echo "=== 检查 ACR 镜像 ==="
echo ""

# 1. 列出所有仓库
echo "1. 列出所有仓库..."
az acr repository list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --output table

echo ""

# 2. 检查特定镜像的标签
echo "2. 检查镜像标签: $IMAGE_REPO"
az acr repository show-tags \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --repository "$IMAGE_REPO" \
  --output table 2>/dev/null || {
    echo "❌ 镜像仓库不存在或没有标签"
    echo ""
    echo "需要重新构建并推送镜像"
    exit 1
}

echo ""

# 3. 检查 latest 标签的详细信息
echo "3. 检查 latest 标签的详细信息..."
az acr repository show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --repository "$IMAGE_REPO" \
  --image latest \
  --output table 2>/dev/null || echo "⚠️  无法获取镜像详细信息"

echo ""
echo "=== 检查完成 ==="
