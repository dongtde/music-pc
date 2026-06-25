# 澜音音乐播放器

澜音是一个基于 Vue 3、Vite 和 Electron 构建的桌面音乐播放器。项目包含音乐首页、发现页、歌单/专辑/歌手详情、播客、电台、MV、播放队列、桌面歌词、主题切换和本地播放状态缓存等功能。

## 技术栈

- Vue 3 + Vue Router
- Vite
- Electron
- Naive UI
- lucide-vue-next
- Axios
- electron-builder

## 快速开始

```bash
npm install
npm run dev
```

默认开发服务运行在 `http://127.0.0.1:5173`。

## 桌面端开发

先启动 Vite 开发服务：

```bash
npm run desktop:dev
```

再启动 Electron 调试入口：

```bash
npm run desktop:debug
```

也可以在已有前端构建结果的情况下直接启动 Electron：

```bash
npm run desktop:start
```

## 构建

构建 Web 资源：

```bash
npm run build
```

构建 Windows 桌面安装包和便携版：

```bash
npm run desktop:build
```

仅打包为目录：

```bash
npm run desktop:pack
```

构建产物默认输出到 `release/`。

## 常用脚本

| 命令                           | 说明                       |
| ------------------------------ | -------------------------- |
| `npm run dev`                  | 启动 Vite 开发服务         |
| `npm run build`                | 构建前端资源               |
| `npm run preview`              | 预览构建产物               |
| `npm run desktop:dev`          | 启动桌面端开发用 Vite 服务 |
| `npm run desktop:debug`        | 启动 Electron 调试流程     |
| `npm run desktop:start`        | 直接运行 Electron          |
| `npm run desktop:build`        | 构建 Windows 桌面应用      |
| `npm run desktop:pack`         | 打包桌面应用目录           |
| `npm run baseline:bundle`      | 分析构建包体积             |
| `npm run smoke:routes`         | 路由 smoke 检查            |
| `npm run smoke:first-screen`   | 首屏 smoke 检查            |
| `npm run smoke:fps`            | FPS smoke 检查             |
| `npm run smoke:player`         | 播放器 smoke 检查          |
| `npm run smoke:electron-proxy` | Electron 代理 smoke 检查   |

## 项目结构

```text
.
|-- electron/              # Electron 主进程、预加载脚本、协议代理和桌面能力
|-- public/                # PWA manifest、Service Worker 和图标资源
|-- scripts/               # 构建分析、调试和 smoke 检查脚本
|-- src/
|   |-- api/               # API 请求封装
|   |-- components/        # 通用 UI 和播放器组件
|   |-- composables/       # 组合式逻辑
|   |-- config/            # 应用配置和缓存键
|   |-- data/              # 默认数据
|   |-- router/            # 路由配置
|   |-- services/          # 音乐、播客、MV、歌词等业务服务
|   |-- stores/            # 播放器、主题、登录和资料库状态
|   |-- styles/            # 页面和组件样式
|   `-- views/             # 页面视图
|-- build/                 # 桌面应用图标
|-- dist/                  # 前端构建产物
`-- release/               # Electron 打包产物
```

## 接口与代理

接口配置请从示例文件创建本地配置。可以使用 `.env`，也可以使用 `.env.local`：

```bash
Copy-Item .env.example .env
```

```bash
VITE_KUGOU_API_BASE=/api
VITE_NETEASE_API_BASE=/netease-api
VITE_API_TIMEOUT=120000
VITE_KUGOU_API_TARGET=
VITE_NETEASE_API_TARGET=
VITE_DEV_SERVER_URL=http://127.0.0.1:5173
VITE_DEV_SERVER_PORT=5174
```

前端默认使用以下代理路径：

- 酷狗相关接口：`/api`
- 网易云相关接口：`/netease-api`

Vite 开发代理和 Electron 主进程都会读取 `VITE_KUGOU_API_TARGET`、`VITE_NETEASE_API_TARGET`。旧的 `KUGOU_API_TARGET`、`NETEASE_API_TARGET` 仍保留兼容。

桌面端打包前会自动执行：

```bash
npm run desktop:prepare-env
```

这个命令会从 `.env` / `.env.local` 生成被 Git 忽略的 `build/runtime/runtime.env`，再由 Electron 打包进应用资源目录。这样开源代码里不会出现真实后台地址，打包后的桌面应用仍能读取接口目标。

如果已经生成了桌面应用，也可以把 `.env.local` 放到 exe 同级目录。Electron 启动时会优先读取系统环境变量，其次读取打包资源里的运行时配置和 exe 同级 `.env.local`。

## 相关文档

- `KuGouMusic-API.md`：酷狗接口说明
- `OPTIMIZATION_PLAN.md`：性能和体验优化计划

## 注意事项

- 项目同时存在 `package-lock.json` 和 `pnpm-lock.yaml`。团队协作时建议统一一种包管理器，避免依赖版本漂移。
- 桌面端打包依赖 `build/icon.ico`，不要在清理资源时删除。
- 部分接口依赖第三方服务，开发或打包后如果数据加载异常，请优先检查代理目标和网络可用性。
