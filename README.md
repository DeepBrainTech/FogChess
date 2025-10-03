# 迷雾国际象棋 (FogChess)

一个基于迷雾战争模式的在线国际象棋对战平台，支持实时多人对战。

## 🌟 功能特性

- 🎮 **实时在线对战** - 基于WebSocket的实时通信
- 🌫️ **迷雾战争模式** - 迷雾视野限制机制
- 🏠 **房间系统** - 创建和加入游戏房间
- 📱 **响应式设计** - 支持桌面和移动设备
- ⚡ **现代化技术栈** - Vue 3 + Node.js + TypeScript

## 🛠️ 技术栈

### 前端
- **Vue 3** + TypeScript
- **Vite** - 快速构建工具
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **Socket.io-client** - 实时通信

### 后端
- **Node.js** + TypeScript
- **Express** - Web框架
- **Socket.io** - 实时通信
- **Chess.js** - 国际象棋逻辑 + 特殊迷雾规则

### 部署
- **Docker** + Docker Compose
- **Redis** - 数据缓存（可选）

## 📁 项目结构

```
FogChess/
├── frontend/                 # Vue.js 前端应用
│   ├── src/
│   │   ├── components/       # Vue 组件
│   │   │   ├── chess/        # 棋盘相关组件
│   │   │   └── room/         # 房间相关组件
│   │   ├── stores/           # Pinia 状态管理
│   │   ├── services/         # 服务层
│   │   ├── types/            # TypeScript 类型定义
│   │   ├── views/            # 页面组件
│   │   └── router/           # 路由配置
│   ├── package.json
│   └── Dockerfile
├── backend/                  # Node.js 后端服务
│   ├── src/
│   │   ├── services/         # 业务逻辑服务
│   │   ├── types/            # 类型定义
│   │   └── server.ts         # 服务器入口
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml        # Docker 编排配置
└── package.json             # 根目录配置
```

## 🚀 快速开始

### 环境要求
- Node.js 18.0+
- npm 或 yarn
- Docker（可选，用于容器化部署）

### 方法一：本地开发

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd FogChess
   ```

2. **安装依赖**
   ```bash
   npm run install:all
   ```

3. **启动开发服务器**
   ```bash
   # 同时启动前后端
   npm run dev
   
   # 或者分别启动
   npm run dev:backend   # 后端: http://localhost:3001
   npm run dev:frontend  # 前端: http://localhost:3000
   ```

4. **访问应用**
   - 前端: http://localhost:3000
   - 后端API: http://localhost:3001
   - 健康检查: http://localhost:3001/health

### 方法二：Docker 部署

1. **使用 Docker Compose**
   ```bash
   docker-compose up --build
   ```

2. **访问应用**
   - 前端: http://localhost:3000
   - 后端: http://localhost:3001

## 🎮 使用说明

### 创建房间
1. 访问首页
2. 点击"创建房间"
3. 输入房间名称和你的昵称
4. 等待其他玩家加入

### 加入房间
1. 访问首页
2. 点击"加入房间"
3. 输入房间ID和你的昵称
4. 开始游戏

### 游戏操作
- 点击棋子选择
- 点击目标格子移动
- 支持迷雾战争模式（开发中）

## 🔧 开发指南

### 项目脚本

```bash
# 安装所有依赖
npm run install:all

# 开发模式
npm run dev                 # 同时启动前后端
npm run dev:backend         # 仅启动后端
npm run dev:frontend        # 仅启动前端

# 构建生产版本
npm run build               # 构建所有项目
npm run build:backend       # 仅构建后端
npm run build:frontend      # 仅构建前端

# 启动生产版本
npm start                   # 启动后端服务器
```

### 代码结构说明

#### 前端架构
- **组件化设计**: 棋盘、棋子、房间等独立组件
- **状态管理**: 使用Pinia管理游戏状态和房间状态
- **服务层**: Socket通信和棋盘逻辑分离
- **类型安全**: 完整的TypeScript类型定义

#### 后端架构
- **服务层**: ChessService处理游戏逻辑，RoomService管理房间
- **实时通信**: Socket.io处理WebSocket连接
- **类型共享**: 前后端共享类型定义

## 🐛 已知问题

1. **国际象棋规则**: 目前是基础框架，完整规则待实现
2. **迷雾战争**: 核心特色功能开发中
3. **移动端优化**: 界面适配待完善
4. **错误处理**: 异常情况处理需要加强

## 📋 开发计划

- [x] 项目基础架构搭建
- [x] 前后端通信框架
- [x] 房间管理系统
- [x] 基础UI界面
- [x] 完整国际象棋规则实现
- [x] 迷雾战争机制
- [ ] 在线匹配功能
- [ ] AI对战模式
- [ ] 用户认证系统
- [ ] 游戏统计和分析
- [ ] 移动端优化

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 Issue
- 发送邮件
- 项目讨论区

---

**注意**: 这是一个开发中的项目，部分功能可能不完整。欢迎贡献代码和提出建议！