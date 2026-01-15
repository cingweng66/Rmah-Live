#!/bin/bash

# 检查并修复 PostgreSQL 防火墙规则

RESOURCE_GROUP="mahjong-live"
POSTGRES_NAME="mahjong-postgres-50831"

echo "=== 检查 PostgreSQL 防火墙规则 ==="
echo ""

# 1. 列出所有防火墙规则
echo "1. 当前防火墙规则："
az postgres flexible-server firewall-rule list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query "[].{Name:name, StartIP:startIpAddress, EndIP:endIpAddress}" \
  -o table 2>/dev/null || echo "无法获取防火墙规则"

echo ""

# 2. 检查是否允许 Azure 服务
ALLOW_AZURE=$(az postgres flexible-server firewall-rule list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query "[?startIpAddress=='0.0.0.0' && endIpAddress=='0.0.0.0'].name" -o tsv 2>/dev/null || echo "")

if [ -z "$ALLOW_AZURE" ]; then
    echo "⚠️  未找到允许 Azure 服务的防火墙规则！"
    echo ""
    echo "正在添加防火墙规则..."
    az postgres flexible-server firewall-rule create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$POSTGRES_NAME" \
      --rule-name AllowAzureServices \
      --start-ip-address 0.0.0.0 \
      --end-ip-address 0.0.0.0 \
      --output none
    
    echo "✅ 防火墙规则已添加"
else
    echo "✅ 已存在允许 Azure 服务的规则: $ALLOW_AZURE"
fi

echo ""

# 3. 检查公共网络访问设置
echo "2. 检查公共网络访问设置..."
PUBLIC_ACCESS=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --query "network.publicNetworkAccess" -o tsv 2>/dev/null || echo "")

echo "   公共网络访问: ${PUBLIC_ACCESS:-未设置}"

if [ "$PUBLIC_ACCESS" != "Enabled" ]; then
    echo "⚠️  公共网络访问未启用！"
    echo ""
    read -p "是否启用公共网络访问？(y/n，默认 y): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]] || [ -z "$REPLY" ]; then
        echo "正在启用公共网络访问..."
        az postgres flexible-server update \
          --resource-group "$RESOURCE_GROUP" \
          --name "$POSTGRES_NAME" \
          --public-network-access Enabled \
          --output none
        
        echo "✅ 公共网络访问已启用"
    fi
else
    echo "✅ 公共网络访问已启用"
fi

echo ""
echo "=== 检查完成 ==="
