#!/bin/bash

# 检查应用日志

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 检查应用日志 ==="
echo ""

# 1. 检查 revision 和 replica
echo "1. 检查 Revision 和 Replica..."
REVISIONS=$(az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[].{Name:name, Active:properties.active, TrafficWeight:properties.trafficWeight}" \
  -o table)

echo "$REVISIONS"
echo ""

# 2. 获取最新的 revision
LATEST_REVISION=$(az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[0].name" -o tsv)

echo "最新 Revision: $LATEST_REVISION"
echo ""

# 3. 获取 replica 信息
echo "2. 检查 Replica 状态..."
REPLICAS=$(az containerapp replica list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --revision "$LATEST_REVISION" \
  --query "[].{Name:name, Status:properties.runningState, Created:properties.createdTime}" \
  -o table 2>/dev/null || echo "无法获取 replica 信息")

echo "$REPLICAS"
echo ""

# 4. 尝试获取 console 日志
echo "3. 尝试获取 Console 日志（应用输出）..."
echo "   这可能需要一些时间..."
echo ""

# 尝试多种方式获取日志
az containerapp logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --tail 100 \
  --type console \
  --follow false 2>&1 | head -50 || {
    echo "无法获取 console 日志，尝试其他方式..."
    echo ""
    echo "4. 检查应用配置..."
    az containerapp show \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --query "{
        Image:properties.template.containers[0].image,
        Port:properties.template.containers[0].ports[0].containerPort,
        TargetPort:properties.configuration.ingress.targetPort,
        MinReplicas:properties.template.scale.minReplicas,
        MaxReplicas:properties.template.scale.maxReplicas
      }" -o table
}

echo ""
echo "=== 诊断建议 ==="
echo ""
echo "如果看不到应用日志，可能的原因："
echo "  1. 应用启动失败（数据库连接失败等）"
echo "  2. 应用崩溃"
echo "  3. 端口配置错误"
echo ""
echo "建议："
echo "  1. 在 Azure Portal 中查看 Container App 的 Log stream"
echo "  2. 检查数据库防火墙设置"
echo "  3. 验证环境变量是否正确"
