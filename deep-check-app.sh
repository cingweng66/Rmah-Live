#!/bin/bash

# 深度检查应用启动问题

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"

echo "=== 深度检查应用启动问题 ==="
echo ""

# 1. 检查所有 Revision 和 Replica
echo "1. 检查所有 Revision 和 Replica..."
az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[].{Name:name, Active:properties.active, TrafficWeight:properties.trafficWeight, Created:properties.createdTime}" \
  -o table

echo ""

# 2. 获取最新的 Revision
LATEST_REVISION=$(az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[0].name" -o tsv)

echo "最新 Revision: $LATEST_REVISION"
echo ""

# 3. 检查 Replica 状态
echo "2. 检查 Replica 状态..."
az containerapp replica list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --revision "$LATEST_REVISION" \
  --query "[].{Name:name, Status:properties.runningState, Created:properties.createdTime, RestartCount:properties.containerStatuses[0].restartCount}" \
  -o table 2>/dev/null || echo "无法获取 Replica 信息"

echo ""

# 4. 检查环境变量
echo "3. 检查关键环境变量..."
az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_HOST' || name=='DB_PASSWORD' || name=='DB_USERNAME' || name=='DB_DATABASE' || name=='PORT' || name=='NODE_ENV'].{Name:name, Value:value}" \
  -o table

echo ""

# 5. 尝试获取系统日志（不仅仅是 console）
echo "4. 尝试获取系统日志..."
echo "   这可能需要一些时间..."
echo ""

# 尝试获取不同类型的日志
echo "   - Console 日志（应用输出）:"
az containerapp logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --type console \
  --tail 50 \
  --follow false 2>&1 | head -30 || echo "   无法获取 console 日志"

echo ""
echo "   - System 日志（系统事件）:"
az containerapp logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --type system \
  --tail 50 \
  --follow false 2>&1 | head -30 || echo "   无法获取 system 日志"

echo ""

# 6. 检查镜像和配置
echo "5. 检查镜像和配置..."
az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "{
    Image:properties.template.containers[0].image,
    ContainerPort:properties.template.containers[0].ports[0].containerPort,
    TargetPort:properties.configuration.ingress.targetPort,
    CPU:properties.template.containers[0].resources.cpu,
    Memory:properties.template.containers[0].resources.memory
  }" -o table

echo ""

# 7. 测试数据库连接（从 Container App 环境变量）
echo "6. 测试数据库连接..."
DB_HOST=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_HOST'].value" -o tsv 2>/dev/null || echo "")

DB_PASSWORD=$(az containerapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "properties.template.containers[0].env[?name=='DB_PASSWORD'].value" -o tsv 2>/dev/null || echo "")

if [ -n "$DB_HOST" ] && [ -n "$DB_PASSWORD" ]; then
    echo "   数据库地址: $DB_HOST"
    echo "   测试连接..."
    
    if command -v docker &> /dev/null; then
        CONNECTION_TEST=$(docker run --rm \
          -e PGPASSWORD="${DB_PASSWORD}" \
          postgres:15-alpine \
          psql -h "${DB_HOST}" -U postgres -d mahjong_db -c "SELECT 1;" 2>&1 | head -5 || echo "FAILED")
        
        if echo "$CONNECTION_TEST" | grep -q "1 row\|1\s*$"; then
            echo "   ✅ 数据库连接成功"
        else
            echo "   ❌ 数据库连接失败"
            echo "   错误: $CONNECTION_TEST"
        fi
    else
        echo "   ⚠️  Docker 未安装，无法测试数据库连接"
    fi
else
    echo "   ⚠️  无法获取数据库配置信息"
fi

echo ""

# 8. 建议
echo "=== 诊断建议 ==="
echo ""
echo "如果应用完全没有日志输出，可能的原因："
echo "  1. 应用在启动时立即崩溃（数据库连接失败、代码错误等）"
echo "  2. 应用没有正确启动（CMD 命令错误）"
echo "  3. 应用输出被重定向或丢失"
echo ""
echo "建议操作："
echo "  1. 在 Azure Portal 中查看 Container App 的 Log stream（实时日志）"
echo "  2. 检查数据库连接：./fix-db-connection.sh"
echo "  3. 验证环境变量是否正确"
echo "  4. 检查 Dockerfile 中的 CMD 命令是否正确"
echo "  5. 尝试本地运行容器测试："
echo "     docker run -it --rm \\"
echo "       -e PORT=3000 \\"
echo "       -e DB_HOST=... \\"
echo "       -e DB_PASSWORD=... \\"
echo "       mahjongacr53114.azurecr.io/mahjong-backend-53114:latest"
