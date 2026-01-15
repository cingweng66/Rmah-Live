#!/bin/bash

# 修复 Revision 问题

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 修复 Container App Revision ==="
echo ""

# 1. 检查当前状态
echo "1. 检查当前 Revision 状态..."
az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[].{Name:name, Active:properties.active, TrafficWeight:properties.trafficWeight, RunningState:properties.runningState}" \
  -o table

echo ""

# 2. 获取最新的 revision（NotRunning 的那个）
LATEST_REVISION=$(az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[0].name" -o tsv)

echo "最新 Revision: $LATEST_REVISION"
echo ""

# 3. 检查这个 revision 的详细信息
echo "2. 检查 Revision 详细信息..."
az containerapp revision show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --revision "$LATEST_REVISION" \
  --query "{
    Name:name,
    Active:properties.active,
    TrafficWeight:properties.trafficWeight,
    RunningState:properties.runningState,
    Replicas:properties.replicas,
    Image:properties.template.containers[0].image
  }" -o table

echo ""

# 4. 检查 replica 状态
echo "3. 检查 Replica 状态..."
REPLICAS=$(az containerapp replica list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --revision "$LATEST_REVISION" \
  --query "[].{Name:name, Status:properties.runningState, Created:properties.createdTime}" \
  -o table 2>/dev/null || echo "无法获取 replica 信息")

echo "$REPLICAS"
echo ""

# 5. 尝试激活旧版本（如果新版本有问题）
read -p "是否激活旧版本 revision (mahjong-backend-53114--0000002)？(y/n，默认 y): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z "$REPLY" ]]; then
    echo "4. 激活旧版本..."
    az containerapp ingress traffic set \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --revision-weight mahjong-backend-53114--0000002=100 \
      --revision-weight "$LATEST_REVISION"=0 \
      --output none
    
    echo "✅ 已切换到旧版本"
    echo ""
    echo "等待 10 秒后测试..."
    sleep 10
    
    BACKEND_URL=$(az containerapp show \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --query "properties.configuration.ingress.fqdn" -o tsv)
    
    echo "测试健康检查..."
    curl -s --max-time 10 "https://$BACKEND_URL/health" | head -5 || echo "健康检查失败"
fi

echo ""
echo "=== 下一步 ==="
echo ""
echo "如果旧版本可以工作，说明新镜像有问题。"
echo "需要检查："
echo "  1. 数据库连接配置"
echo "  2. PostgreSQL 防火墙设置"
echo "  3. 环境变量是否正确"
