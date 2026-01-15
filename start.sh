#!/bin/bash

# 智能启动脚本 - 自动检测并切换到项目目录

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# 如果脚本不在项目根目录，尝试查找项目目录
if [ ! -f "$SCRIPT_DIR/package.json" ] || [ ! -d "$SCRIPT_DIR/backend" ]; then
  # 尝试常见位置
  POSSIBLE_DIRS=(
    "$HOME/Downloads/日麻直播记分系统 (1)"
    "$HOME/Downloads/日麻直播记分系统"
    "$(dirname "$SCRIPT_DIR")"
  )
  
  for dir in "${POSSIBLE_DIRS[@]}"; do
    if [ -f "$dir/package.json" ] && [ -d "$dir/backend" ]; then
      PROJECT_DIR="$dir"
      break
    fi
  done
fi

# 切换到项目目录
cd "$PROJECT_DIR" || {
  echo "❌ 无法找到项目目录"
  echo "请手动切换到项目目录："
  echo "  cd ~/Downloads/日麻直播记分系统\\ \\(1\\)"
  exit 1
}

# 运行实际的启动脚本
if [ -f "$PROJECT_DIR/dev-start.sh" ]; then
  exec "$PROJECT_DIR/dev-start.sh"
else
  echo "❌ 找不到 dev-start.sh 脚本"
  exit 1
fi
