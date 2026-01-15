#!/bin/bash

# 检查端口和 Ingress 配置

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 检查端口和 Ingress 配置 ==="
echo ""

# 1. 检查 Container App 的端口配置
echo "1. 检查容器端口配置..."
CONTAINER_PORT=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].ports[0].containerPort" -o tsv 2>/dev/null || echo "")

echo "   容器端口: ${CONTAINER_PORT:-未设置}"
echo ""

# 2. 检查 Ingress 配置
echo "2. 检查 Ingress 配置..."
INGRESS_CONFIG=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "{
    External:properties.configuration.ingress.external,
    TargetPort:properties.configuration.ingress.targetPort,
    Transport:properties.configuration.ingress.transport,
    AllowInsecure:properties.configuration.ingress.allowInsecure,
    FQDN:properties.configuration.ingress.fqdn
  }" -o table 2>/dev/null || echo "")

echo "$INGRESS_CONFIG"
echo ""

# 3. 检查环境变量中的 PORT
echo "3. 检查环境变量 PORT..."
ENV_PORT=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='PORT'].value" -o tsv 2>/dev/null || echo "")

echo "   环境变量 PORT: ${ENV_PORT:-未设置}"
echo ""

# 4. 检查应用状态
echo "4. 检查应用运行状态..."
APP_STATUS=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "{
    RunningStatus:properties.runningStatus,
    ProvisioningState:properties.provisioningState,
    MinReplicas:properties.template.scale.minReplicas,
    MaxReplicas:properties.template.scale.maxReplicas
  }" -o table 2>/dev/null || echo "")

echo "$APP_STATUS"
echo ""

# 5. 诊断问题
echo "=== 诊断 ==="
echo ""

# 检查端口一致性
if [ -n "$CONTAINER_PORT" ] && [ -n "$ENV_PORT" ]; then
    if [ "$CONTAINER_PORT" != "$ENV_PORT" ]; then
        echo "⚠️  容器端口 ($CONTAINER_PORT) 与环境变量 PORT ($ENV_PORT) 不一致！"
        echo "   这可能导致应用无法正确监听端口"
    else
        echo "✅ 容器端口与环境变量 PORT 一致: $CONTAINER_PORT"
    fi
fi

# 检查 Ingress targetPort
TARGET_PORT=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.configuration.ingress.targetPort" -o tsv 2>/dev/null || echo "")

if [ -n "$TARGET_PORT" ] && [ -n "$CONTAINER_PORT" ]; then
    if [ "$TARGET_PORT" != "$CONTAINER_PORT" ]; then
        echo "⚠️  Ingress targetPort ($TARGET_PORT) 与容器端口 ($CONTAINER_PORT) 不一致！"
        echo "   这会导致请求无法路由到应用"
    else
        echo "✅ Ingress targetPort 与容器端口一致: $TARGET_PORT"
    fi
fi

echo ""

# 6. 建议修复
echo "=== 建议修复 ==="
echo ""

if [ -z "$CONTAINER_PORT" ] || [ "$CONTAINER_PORT" != "3000" ]; then
    echo "1. 容器端口应该设置为 3000"
    echo "   运行以下命令修复："
    echo "   az containerapp update \\"
    echo "     --resource-group $RESOURCE_GROUP \\"
    echo "     --name $BACKEND_NAME \\"
    echo "     --set-env-vars PORT=3000"
    echo ""
fi

if [ -z "$TARGET_PORT" ] || [ "$TARGET_PORT" != "3000" ]; then
    echo "2. Ingress targetPort 应该设置为 3000"
    echo "   运行以下命令修复："
    echo "   az containerapp ingress enable \\"
    echo "     --resource-group $RESOURCE_GROUP \\"
    echo "     --name $BACKEND_NAME \\"
    echo "     --type external \\"
    echo "     --target-port 3000 \\"
    echo "     --transport http \\"
    echo "     --allow-insecure false"
    echo ""
fi

echo "3. 查看应用日志以确认应用是否启动："
echo "   ./check-logs.sh"
echo ""
echo "4. 如果应用没有启动，检查数据库连接："
echo "   ./fix-db-connection.sh"
