#!/bin/bash

# 配置 Docker 镜像加速器（解决网络问题）

echo "=== 配置 Docker 镜像加速器 ==="
echo ""
echo "这将帮助您更快地拉取 Docker 镜像"
echo ""

# 检查 Docker Desktop 配置目录
DOCKER_CONFIG="$HOME/.docker/daemon.json"

echo "1. 检查现有配置..."
if [ -f "$DOCKER_CONFIG" ]; then
    echo "   发现现有配置，将备份为 daemon.json.bak"
    cp "$DOCKER_CONFIG" "$DOCKER_CONFIG.bak"
fi

# 创建或更新配置
echo ""
echo "2. 配置镜像加速器（使用阿里云和 Docker 官方）..."
cat > "$DOCKER_CONFIG" << 'EOF'
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ],
  "experimental": false,
  "debug": false
}
EOF

echo "✅ 配置已保存到: $DOCKER_CONFIG"
echo ""
echo "3. 重启 Docker Desktop 以应用配置"
echo "   请："
echo "   1. 退出 Docker Desktop"
echo "   2. 重新启动 Docker Desktop"
echo "   3. 等待完全启动后，运行: docker info | grep -A 5 'Registry Mirrors'"
echo ""
echo "   或运行以下命令验证："
echo "   docker info | grep -A 5 'Registry Mirrors'"
