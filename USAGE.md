# 使用说明

## 系统架构

本系统支持**双设备模式**：
- **控制设备**：需要注册/登录，进行游戏状态控制
- **显示设备**：只需输入房间号，即可显示直播画面

## 快速开始

### 1. 启动后端服务

```bash
cd backend

# 方式1：使用 Docker（推荐）
./start-docker.sh

# 方式2：本地启动（需要先安装 PostgreSQL 和 Redis）
./start-local.sh
```

后端服务默认运行在 `http://localhost:3000`

### 2. （可选）创建管理员账号

如果需要预先创建管理员账号，可以运行：

```bash
cd backend
npm run create-admin
```

**注意**：现在系统支持自动创建 License，普通用户注册时会自动获得免费 License，无需手动激活。

### 3. 启动前端

```bash
# 在项目根目录
npm install
npm run dev
```

前端服务默认运行在 `http://localhost:8080`

## 使用流程

### 控制设备（需要登录）

1. **访问控制面板**
   - 打开 `http://localhost:8080/#/`
   - 如果未登录，会自动跳转到登录页面

2. **注册/登录**
   - **注册新账号**：输入姓名、邮箱、密码，点击"注册"
     - 系统会自动创建并激活 License（无需手动操作）
     - 注册成功后自动跳转到控制面板
   - **登录已有账号**：输入邮箱、密码，点击"登录"
     - 如果没有 License，系统会自动创建一个
     - 登录成功后自动跳转到控制面板

3. **开始游戏**
   - 在控制面板中设置玩家信息、局数、本场等
   - 所有操作会自动同步到显示设备

4. **获取房间号**
   - 默认房间号为 `default`
   - 在控制面板顶部可以看到当前房间号和显示设备访问地址

### 显示设备（只需房间号）

1. **访问显示页面**
   - 布局1：`http://localhost:8080/#/display-public?room=default`
   - 布局2：`http://localhost:8080/#/display-public2?room=default`
   - 布局3：`http://localhost:8080/#/display-public3?room=default`

2. **输入房间号**
   - 如果 URL 中没有房间号，会显示输入框
   - 输入房间号（如 `default`）后点击"连接"

3. **实时显示**
   - 页面会自动连接 WebSocket 接收实时更新
   - 无需登录，无需认证

## API 端点

### 公开端点（显示设备使用）

- `GET /game/public/:gameId` - 获取游戏状态（无需认证）

### 需要认证的端点（控制设备使用）

- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录
- `POST /auth/activate-license` - 激活 License
- `GET /auth/license` - 获取 License 信息
- `GET /auth/profile` - 获取用户信息
- `GET /game/state/:gameId` - 获取游戏状态
- `POST /game/state` - 更新游戏状态
- `GET /game/sessions` - 获取游戏会话列表

### WebSocket

- 连接地址：`ws://localhost:3000/game`
- **控制模式**：需要 JWT Token，可以发送 `game-update` 事件
- **只读模式**：无需 Token，只能接收 `game-state` 事件

## 房间号管理

- 默认房间号为 `default`
- 可以在控制面板中创建多个游戏会话
- 每个会话有独立的 `gameId`
- 显示设备通过 `gameId` 连接到对应的游戏会话

## 注意事项

1. **控制设备**只需注册/登录即可使用，系统会自动处理 License
2. **显示设备**无需任何认证，只需房间号
3. 房间号由控制设备提供，确保显示设备输入正确的房间号
4. WebSocket 连接会自动重连，但需要确保后端服务正常运行
5. 如果显示设备无法连接，检查：
   - 后端服务是否运行
   - 房间号是否正确
   - 网络连接是否正常

## 简化说明

为了让小白用户也能轻松使用，系统已经简化了所有流程：

- ✅ **注册即用**：注册账号时自动创建并激活 License，无需手动操作
- ✅ **登录即用**：登录时如果没有 License 会自动创建，无需额外步骤
- ✅ **显示设备**：只需输入房间号，无需任何认证或配置
- ✅ **图形界面**：所有操作都通过网页界面完成，无需命令行操作

## 部署到生产环境

参考 `DEPLOYMENT.md` 获取详细的部署说明。
