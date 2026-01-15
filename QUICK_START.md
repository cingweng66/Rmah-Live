# 🚀 快速启动指南

## 第一步：进入项目目录

```bash
cd ~/Downloads/日麻直播记分系统\ \(1\)
```

或者使用引号：

```bash
cd ~/Downloads/"日麻直播记分系统 (1)"
```

## 第二步：启动开发环境

### 方式一：使用智能启动脚本（推荐）

```bash
./start.sh
```

这个脚本会自动找到项目目录并启动。

### 方式二：使用开发工具脚本

```bash
./dev-start.sh
```

### 方式三：使用 npm 命令

```bash
npm run dev:start
```

## 验证启动成功

启动后，你应该看到：

```
✨ 开发环境启动完成！

📱 前端地址: http://localhost:8080
🔧 后端地址: http://localhost:3000
📡 API 文档: http://localhost:3000/game
```

## 如果遇到 "no such file or directory" 错误

**原因**：你不在项目目录中

**解决**：
1. 先切换到项目目录（见第一步）
2. 然后再运行启动脚本

## 快速检查

运行以下命令检查你是否在正确的目录：

```bash
# 应该能看到 package.json 和 backend 目录
ls -la | grep package.json
ls -d backend
```

如果看不到，说明不在项目目录，请先执行第一步。

## 其他常用命令

```bash
# 健康检查
./dev-check.sh

# 查看日志
./dev-logs.sh

# 创建测试用户
./dev-test-user.sh
```

## 需要帮助？

查看完整文档：
- [DEV_GUIDE.md](./DEV_GUIDE.md) - 开发者指南
- [DEV_QUICK_REF.md](./DEV_QUICK_REF.md) - 快速参考
