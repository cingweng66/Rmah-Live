#!/bin/bash

# 等待应用启动并测试

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 等待应用启动并测试 ==="
echo ""

# 1. 等待应用启动
echo "1. 等待应用启动（90秒）..."
sleep 90

# 2. 检查应用状态
echo ""
echo "2. 检查应用状态..."
APP_STATUS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "{
    RunningStatus:properties.runningStatus,
    ActiveRevision:properties.latestRevisionName,
    MinReplicas:properties.template.scale.minReplicas
  }" -o table)

echo "$APP_STATUS"
echo ""

# 3. 检查最新的 Replica 状态
LATEST_REVISION=$(az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[0].name" -o tsv)

echo "3. 检查 Replica 状态..."
REPLICA_STATUS=$(az containerapp replica list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --revision "$LATEST_REVISION" \
  --query "[].{Name:name, Status:properties.runningState, RestartCount:properties.containerStatuses[0].restartCount}" \
  -o table 2>/dev/null || echo "无法获取 Replica 信息")

echo "$REPLICA_STATUS"
echo ""

# 4. 检查系统日志（查看是否有镜像拉取错误）
echo "4. 检查最近的系统日志..."
RECENT_LOGS=$(az containerapp logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --type system \
  --tail 20 \
  --follow false 2>&1 | grep -E "ImagePull|Pulling|Running|Started" | tail -10 || echo "无相关日志")

if [ -n "$RECENT_LOGS" ]; then
    echo "$RECENT_LOGS"
else
    echo "   未发现相关日志"
fi

echo ""

# 5. 检查应用日志（查看应用输出）
echo "5. 检查应用日志（应用输出）..."
APP_LOGS=$(az containerapp logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --type console \
  --tail 30 \
  --follow false 2>&1 | grep -v "Connecting to the container" | grep -v "Successfully Connected" | head -20 || echo "无应用日志")

if [ -n "$APP_LOGS" ] && [ "$APP_LOGS" != "无应用日志" ]; then
    echo "$APP_LOGS"
else
    echo "   ⚠️  没有应用日志输出"
    echo "   应用可能还没有启动，或者日志还没有生成"
fi

echo ""

# 6. 测试健康检查
echo "6. 测试健康检查..."
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "   后端 URL: https://$BACKEND_URL"
echo ""

for i in {1..10}; do
    echo "   尝试 $i/10..."
    RESPONSE=$(curl -s --max-time 10 "https://$BACKEND_URL/health" 2>&1 || echo "TIMEOUT")
    
    if echo "$RESPONSE" | grep -q "status\|ok\|healthy"; then
        echo ""
        echo "✅ 健康检查成功！"
        echo "   响应: $RESPONSE"
        echo ""
        echo "🎉 应用已成功启动！"
        exit 0
    elif echo "$RESPONSE" | grep -q "TIMEOUT\|Connection refused\|Connection reset"; then
        echo "   ⏳ 等待中... (连接超时或拒绝)"
        sleep 15
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
echo "  2. 在 Azure Portal 中查看 Container App 的 Log stream"
echo "  3. 确认应用是否成功启动（查看 Replica 状态）"
