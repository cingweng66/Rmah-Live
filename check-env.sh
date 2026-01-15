#!/bin/bash

# 检查 Container App 环境变量

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 检查环境变量 ==="
echo ""

az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[].{Name:name, Value:value}" \
  -o table

echo ""
echo "关键环境变量检查："
echo ""

# 检查关键变量
DB_HOST=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_HOST'].value" -o tsv)

DB_PASSWORD=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_PASSWORD'].value" -o tsv)

FRONTEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='FRONTEND_URL'].value" -o tsv)

echo "DB_HOST: ${DB_HOST:-未设置}"
echo "DB_PASSWORD: ${DB_PASSWORD:+已设置（隐藏）} ${DB_PASSWORD:-未设置}"
echo "FRONTEND_URL: ${FRONTEND_URL:-未设置}"
echo ""

if [ -z "$DB_HOST" ] || [ -z "$DB_PASSWORD" ]; then
    echo "⚠️  警告：数据库配置不完整！"
fi
