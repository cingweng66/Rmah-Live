#!/bin/bash

# 修复 ACR 认证问题

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
ACR_NAME="mahjongacr53114"

echo "=== 修复 ACR 认证问题 ==="
echo ""

# 1. 获取 ACR 信息
echo "1. 获取 ACR 信息..."
ACR_LOGIN_SERVER=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query loginServer -o tsv 2>/dev/null || echo "")

if [ -z "$ACR_LOGIN_SERVER" ]; then
    echo "❌ 无法获取 ACR 信息，请检查 ACR 名称是否正确"
    exit 1
fi

echo "   ACR 登录服务器: $ACR_LOGIN_SERVER"
echo ""

# 2. 获取 ACR 管理员凭据
echo "2. 获取 ACR 管理员凭据..."
ACR_USERNAME=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query username -o tsv 2>/dev/null || echo "")

ACR_PASSWORD=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query passwords[0].value -o tsv 2>/dev/null || echo "")

if [ -z "$ACR_USERNAME" ] || [ -z "$ACR_PASSWORD" ]; then
    echo "⚠️  无法获取 ACR 凭据，尝试启用管理员用户..."
    az acr update \
      --resource-group "$RESOURCE_GROUP" \
      --name "$ACR_NAME" \
      --admin-enabled true \
      --output none
    
    sleep 5
    
    ACR_USERNAME=$(az acr credential show \
      --resource-group "$RESOURCE_GROUP" \
      --name "$ACR_NAME" \
      --query username -o tsv 2>/dev/null || echo "")
    
    ACR_PASSWORD=$(az acr credential show \
      --resource-group "$RESOURCE_GROUP" \
      --name "$ACR_NAME" \
      --query passwords[0].value -o tsv 2>/dev/null || echo "")
fi

if [ -z "$ACR_USERNAME" ] || [ -z "$ACR_PASSWORD" ]; then
    echo "❌ 无法获取 ACR 凭据"
    exit 1
fi

echo "   ACR 用户名: $ACR_USERNAME"
echo "   ACR 密码: ${ACR_PASSWORD:0:4}...（已隐藏）"
echo ""

# 3. 更新 Container App 的 registry 配置
echo "3. 更新 Container App 的 registry 配置..."
az containerapp registry set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --server "$ACR_LOGIN_SERVER" \
  --username "$ACR_USERNAME" \
  --password "$ACR_PASSWORD" \
  --output none

echo "✅ Registry 配置已更新"
echo ""

# 4. 触发重启
echo "4. 触发应用重启..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "RESTART_TRIGGER=$(date +%s)" \
  --output none

echo "✅ 重启已触发"
echo ""

# 5. 等待重启
echo "5. 等待应用重启（60秒）..."
sleep 60

# 6. 检查应用状态
echo ""
echo "6. 检查应用状态..."
APP_STATUS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "{
    RunningStatus:properties.runningStatus,
    ActiveRevision:properties.latestRevisionName
  }" -o table)

echo "$APP_STATUS"
echo ""

# 7. 检查最新的 Replica 状态
LATEST_REVISION=$(az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[0].name" -o tsv)

echo "7. 检查 Replica 状态..."
az containerapp replica list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --revision "$LATEST_REVISION" \
  --query "[].{Name:name, Status:properties.runningState, RestartCount:properties.containerStatuses[0].restartCount}" \
  -o table 2>/dev/null || echo "无法获取 Replica 信息"

echo ""

# 8. 测试健康检查
echo "8. 测试健康检查..."
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
        echo "🎉 ACR 认证问题已修复！"
        exit 0
    else
        echo "   ⏳ 等待中... ($RESPONSE)"
        sleep 10
    fi
done

echo ""
echo "⚠️  健康检查仍然失败"
echo ""
echo "请检查："
echo "  1. 运行 ./check-logs.sh 查看应用日志"
echo "  2. 确认镜像是否存在于 ACR 中"
echo "  3. 检查应用是否成功启动"
