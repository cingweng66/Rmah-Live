#!/bin/bash

# 后端诊断和修复脚本

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 后端诊断和修复 ==="
echo ""

# 1. 检查当前状态
echo "1. 检查 Container App 状态..."
az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "{
    Status:properties.runningStatus,
    MinReplicas:properties.template.scale.minReplicas,
    MaxReplicas:properties.template.scale.maxReplicas,
    CPU:properties.template.containers[0].resources.cpu,
    Memory:properties.template.containers[0].resources.memory
  }" -o table

echo ""

# 2. 确保副本数至少为 1
echo "2. 确保最小副本数为 1..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --min-replicas 1 \
  --max-replicas 3 \
  --output none

echo "✅ 副本数已更新"
echo ""

# 3. 重启容器（通过更新环境变量触发重启）
echo "3. 触发容器重启（通过更新环境变量）..."
# 获取当前 revision
CURRENT_REVISION=$(az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[0].name" -o tsv 2>/dev/null || echo "")

if [ -n "$CURRENT_REVISION" ]; then
    echo "   当前 Revision: $CURRENT_REVISION"
    az containerapp revision restart \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --revision "$CURRENT_REVISION" \
      --output none 2>/dev/null || echo "   重启命令失败，尝试通过更新触发重启..."
else
    echo "   无法获取 revision，通过更新环境变量触发重启..."
    # 通过更新一个环境变量来触发重启
    az containerapp update \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --set-env-vars "RESTART_TRIGGER=$(date +%s)" \
      --output none 2>/dev/null || echo "   更新失败"
fi

echo "✅ 重启已触发"
echo ""

# 4. 等待启动
echo "4. 等待应用启动（30秒）..."
sleep 30

# 5. 获取 URL
BACKEND_URL=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "后端 URL: https://$BACKEND_URL"
echo ""

# 6. 测试健康检查
echo "5. 测试健康检查..."
for i in {1..3}; do
    echo "   尝试 $i/3..."
    RESPONSE=$(curl -s --max-time 5 "https://$BACKEND_URL/health" 2>&1 || echo "TIMEOUT")
    if echo "$RESPONSE" | grep -q "status"; then
        echo "✅ 健康检查成功！"
        echo "$RESPONSE" | head -3
        exit 0
    else
        echo "   ⏳ 等待中..."
        sleep 5
    fi
done

echo ""
echo "⚠️  健康检查仍然失败"
echo ""
echo "可能的原因："
echo "  1. 应用启动失败（数据库连接问题等）"
echo "  2. 应用监听端口不正确"
echo "  3. 环境变量配置错误"
echo ""
echo "请检查："
echo "  - 数据库连接信息是否正确"
echo "  - 环境变量是否完整"
echo "  - 在 Azure Portal 中查看 Container App 的日志"
