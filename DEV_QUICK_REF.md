# 开发者快速参考

## 🚀 一键命令

```bash
# 启动开发环境（推荐）
./dev-start.sh
npm run dev:start

# 健康检查
./dev-check.sh
npm run dev:check

# 查看日志
./dev-logs.sh
npm run dev:logs

# 创建测试用户
./dev-test-user.sh
npm run dev:test-user

# 配置管理
./dev-config.sh
npm run dev:config

# 重置环境（⚠️ 会清空数据）
./dev-reset.sh
npm run dev:reset
```

## 📍 访问地址

- **前端**: http://localhost:8080
- **后端**: http://localhost:3000
- **API 文档**: http://localhost:3000/game
- **健康检查**: http://localhost:3000/health

## 🔧 常用调试命令

```bash
# 检查端口占用
lsof -i :3000
lsof -i :8080

# 查看 Docker 容器
docker ps
docker logs <container_id>

# 进入数据库
docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d mahjong_db

# 进入 Redis
docker exec -it $(docker ps -q -f name=redis) redis-cli

# 清理构建
rm -rf backend/dist dist node_modules/.vite
```

## 📝 配置文件位置

- 前端: `.env`
- 后端: `backend/.env`
- Docker: `backend/docker-compose.yml`

## 🐛 快速排查

| 问题 | 命令 |
|------|------|
| 服务未启动 | `./dev-check.sh` |
| 查看错误日志 | `./dev-logs.sh` |
| 配置问题 | `./dev-config.sh` |
| 数据库问题 | `docker ps \| grep postgres` |
| 端口占用 | `lsof -i :3000` |
| 重置环境 | `./dev-reset.sh` |

## 💡 开发流程

1. **启动**: `./dev-start.sh`
2. **检查**: `./dev-check.sh`
3. **开发**: 修改代码
4. **测试**: 访问 http://localhost:8080
5. **调试**: `./dev-logs.sh`
6. **提交**: 运行检查后提交代码
