#!/bin/bash

# Azure 订阅检查脚本

echo "=== Azure 订阅信息 ==="
echo ""

# 检查登录状态
if ! az account show &> /dev/null; then
    echo "❌ 未登录 Azure"
    echo "请运行: az login"
    exit 1
fi

echo "✅ 已登录 Azure"
echo ""

# 显示当前订阅
echo "📋 当前订阅："
az account show --query "{名称:name, ID:id, 状态:state, 租户ID:tenantId}" -o table
echo ""

# 列出所有订阅
echo "📋 所有可用订阅："
az account list --query "[].{名称:name, ID:id, 是否默认:isDefault, 状态:state}" -o table
echo ""

# 检查订阅状态
CURRENT_SUB_STATE=$(az account show --query state -o tsv)
if [ "$CURRENT_SUB_STATE" != "Enabled" ]; then
    echo "⚠️  警告：当前订阅状态为: $CURRENT_SUB_STATE"
    echo "   订阅可能已过期或被禁用"
    echo ""
    echo "💡 建议："
    echo "   1. 检查订阅是否有效"
    echo "   2. 切换到其他可用订阅："
    echo "      az account set --subscription <subscription-id>"
fi

echo ""
echo "💡 切换订阅："
echo "   az account set --subscription <subscription-id>"
