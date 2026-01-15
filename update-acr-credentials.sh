#!/bin/bash

# 重新写入 ACR 凭据到 Container App

set -e

RESOURCE_GROUP="mahjong-live"
BACKEND_NAME="mahjong-backend-53114"
ACR_NAME="mahjongacr53114"

echo "=== 重新写入 ACR 凭据 ==="
echo ""

# 1. 获取 ACR 信息
echo "1. 获取 ACR 信息..."
ACR_LOGIN_SERVER=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query loginServer -o tsv)

if [ -z "$ACR_LOGIN_SERVER" ]; then
    echo "❌ 无法获取 ACR 信息"
    exit 1
fi

echo "   ACR 登录服务器: $ACR_LOGIN_SERVER"
echo ""

# 2. 确保 ACR 管理员用户已启用
echo "2. 确保 ACR 管理员用户已启用..."
ADMIN_ENABLED=$(az acr show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query adminUserEnabled -o tsv)

if [ "$ADMIN_ENABLED" != "true" ]; then
    echo "   启用 ACR 管理员用户..."
    az acr update \
      --resource-group "$RESOURCE_GROUP" \
      --name "$ACR_NAME" \
      --admin-enabled true \
      --output none
    
    echo "✅ 管理员用户已启用"
    sleep 5
else
    echo "✅ 管理员用户已启用"
fi

echo ""

# 3. 获取最新的 ACR 凭据
echo "3. 获取最新的 ACR 凭据..."
ACR_USERNAME=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query username -o tsv)

ACR_PASSWORD=$(az acr credential show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --query passwords[0].value -o tsv)

if [ -z "$ACR_USERNAME" ] || [ -z "$ACR_PASSWORD" ]; then
    echo "❌ 无法获取 ACR 凭据"
    exit 1
fi

echo "   ACR 用户名: $ACR_USERNAME"
echo "   ACR 密码: ${ACR_PASSWORD:0:4}...（已隐藏）"
echo ""

# 4. 删除现有的 registry 配置
echo "4. 删除现有的 registry 配置..."
EXISTING_REGISTRIES=$(az containerapp registry list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --query "[].server" -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_REGISTRIES" ]; then
    for server in $EXISTING_REGISTRIES; do
        echo "   删除现有配置: $server"
        az containerapp registry remove \
          --resource-group "$RESOURCE_GROUP" \
          --name "$BACKEND_NAME" \
          --server "$server" \
          --output none 2>/dev/null || true
    done
    echo "✅ 旧的配置已删除"
    sleep 3
else
    echo "   没有现有的 registry 配置"
fi

echo ""

# 5. 添加新的 registry 配置
echo "5. 添加新的 registry 配置..."

# 检查是否设置了 SSL 验证禁用
if [ -n "$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION" ]; then
    echo "   注意：SSL 验证已禁用（VPN/代理环境）"
fi

# 尝试添加 registry 配置，最多重试 3 次
RETRY_COUNT=0
MAX_RETRIES=3
SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    set +e  # 临时禁用错误退出
    if az containerapp registry set \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_NAME" \
      --server "$ACR_LOGIN_SERVER" \
      --username "$ACR_USERNAME" \
      --password "$ACR_PASSWORD" \
      --output none 2>&1; then
        set -e  # 恢复错误退出
        SUCCESS=true
        break
    else
        set -e  # 恢复错误退出
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "   尝试 $RETRY_COUNT/$MAX_RETRIES 失败，等待 10 秒后重试..."
            sleep 10
        fi
    fi
done

if [ "$SUCCESS" = true ]; then
    echo "✅ Registry 配置已添加"
else
    echo "⚠️  Registry 配置添加失败，已重试 $MAX_RETRIES 次"
    echo "   如果遇到 SSL 证书错误，请运行："
    echo "   export AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1"
    echo "   然后重新运行此脚本"
    exit 1
fi

echo ""

# 6. 验证配置
echo "6. 验证 registry 配置..."
VERIFIED_REGISTRIES=$(az containerapp registry list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --output table)

echo "$VERIFIED_REGISTRIES"
echo ""

# 7. 触发 Container App 重启以应用新配置
echo "7. 触发 Container App 重启..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --set-env-vars "ACR_CREDENTIALS_UPDATED=$(date +%s)" \
  --output none

echo "✅ 重启已触发"
echo ""

# 8. 等待配置生效
echo "8. 等待配置生效（60秒）..."
sleep 60

# 9. 检查最新的系统日志
echo ""
echo "9. 检查最新的系统日志..."
RECENT_LOGS=$(az containerapp logs show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_NAME" \
  --type system \
  --tail 15 \
  --follow false 2>&1 | grep -E "ImagePull|Pulling|Running|Started|Successfully|Unauthorized" | tail -10 || echo "无相关日志")

if [ -n "$RECENT_LOGS" ] && [ "$RECENT_LOGS" != "无相关日志" ]; then
    echo "$RECENT_LOGS"
    
    # 检查是否还有认证错误
    if echo "$RECENT_LOGS" | grep -q "Unauthorized"; then
        echo ""
        echo "⚠️  仍然看到认证错误"
        echo "   可能需要等待更长时间，或者需要重新创建 Container App"
    elif echo "$RECENT_LOGS" | grep -q "Successfully\|Running\|Started"; then
        echo ""
        echo "✅ 看到成功的日志，应用可能正在启动"
    fi
else
    echo "   未发现相关日志"
fi

echo ""
echo "=== 完成 ==="
echo ""
echo "请等待几分钟，然后运行："
echo "  ./wait-and-test.sh"
echo ""
echo "或在 Azure Portal 中查看 Container App 的状态和日志"
