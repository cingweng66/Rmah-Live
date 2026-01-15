#!/bin/bash

# 检查 Azure 订阅允许的区域
# 使用方法: ./check-azure-regions.sh

echo "=== Azure 订阅区域检查 ==="
echo ""

# 检查登录状态
if ! az account show &> /dev/null; then
    echo "❌ 未登录 Azure，正在登录..."
    az login
fi

echo "当前订阅: $(az account show --query name -o tsv)"
echo "订阅 ID: $(az account show --query id -o tsv)"
echo ""

echo "=== 推荐区域（Recommended）==="
az account list-locations \
  --query "[?metadata.regionCategory=='Recommended'].{Name:name, DisplayName:displayName, Geography:metadata.geographyGroup}" \
  -o table

echo ""
echo "=== 其他可用区域（Other）==="
az account list-locations \
  --query "[?metadata.regionCategory=='Other'].{Name:name, DisplayName:displayName, Geography:metadata.geographyGroup}" \
  -o table

echo ""
echo "💡 提示："
echo "- 推荐使用 'Recommended' 类别的区域"
echo "- 如果某个区域不可用，请尝试其他推荐区域"
echo "- 常见可用区域：eastus, westus2, westeurope, southeastasia"
