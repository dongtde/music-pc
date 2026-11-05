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
npm ci
npm run dev
```

默认开发服务运行在 `http://127.0.0.1:5173`。

## 前后端独立运行

项目根目录是 Vue/Electron 前端，`backend/` 是独立的一起听后端，拥有自己的依赖与配置，可以单独复制部署。房间默认支持 10 人共同点歌和控制播放，可通过后端的 `LISTENING_ROOM_CAPACITY` 调整人数上限。前端正常浏览和个人播放不需要启动一起听后端。

「加入房间」会自动显示当前一起听服务上已创建的房间，可以直接点击加入，也支持房间码和完整邀请。

首次运行后端，在 `backend/` 中执行 `npm ci`，然后执行 `npm run dev`；前端在项目根目录执行 `npm run dev`。前端开发入口同时支持本机和局域网访问，默认代理到 `http://127.0.0.1:3030`。前后端分别启动。

详见 [后端项目说明](backend/README.md) 和 [一起听运行指南](docs/listening-room.md)。

`npm run build` 会生成 `dist/` 网页资源，同时把前端、独立后台和 Nginx 配置打成 `release/server/` 下的服务器部署压缩包。具体步骤见 [宝塔部署指南](docs/baota-deployment.md)。发布过程的临时目录位于 `node_modules/.cache/`，打包成功后自动清理。

## 桌面端开发

一条命令同时启动 Vite 和 Electron 开发窗口：

```bash
npm run desktop:dev
```

无需再单独启动桌面调试或桌面 Vite 服务。

## 构建

构建 Web 资源和服务器部署包：

```bash
npm run build
```

构建 Windows 桌面安装包和便携版：

```bash
npm run desktop:build
```

桌面安装包和便携版输出到 `release/`；服务器部署包输出到 `release/server/`。网页资源放在 `dist/`，桌面打包中间资源放在 `dist-desktop/`，两种构建互不覆盖。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 打开网页开发环境，支持局域网访问 |
| `npm run build` | 打包网页正式环境和服务器部署包 |
| `npm run desktop:dev` | 打开桌面开发环境，自动启动 Vite 和 Electron |
| `npm run desktop:build` | 打包 Windows 桌面正式安装包和便携版 |

后台在 `backend/` 中使用 `dev`、`build`、`start`，分别用于开发、打包和服务器正式启动。

## 项目结构

```text
.
|-- electron/              # Electron 主进程、预加载脚本、协议代理和桌面能力
|-- backend/               # 独立一起听后端，自带 package.json、配置和打包入口
|-- public/                # PWA manifest、Service Worker 和图标资源
|-- scripts/               # 桌面开发、运行时配置、开发代理和 3D 模型生成
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
`-- release/               # 桌面和服务器发布压缩包
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

`npm run desktop:build` 会自动从 `.env` / `.env.local` 生成被 Git 忽略的 `build/runtime/runtime.env`，再由 Electron 打包进应用资源目录，无需额外运行环境准备命令。实际接口配置不写入仓库。

如果已经生成了桌面应用，也可以把 `.env.local` 放到 exe 同级目录。Electron 启动时会优先读取系统环境变量，其次读取打包资源里的运行时配置和 exe 同级 `.env.local`。

## 相关文档

- [多人一起听](docs/listening-room.md)：`/space` 控制终端的创建房间、加入房间、人数配置、共同点歌和独立服务部署。

- `KuGouMusic-API.md`：酷狗接口说明

## 注意事项

- 前后端统一使用 npm，各自保留 `package-lock.json`；首次安装依赖使用 `npm ci`。
- 桌面端打包依赖 `build/icon.ico`，不要在清理资源时删除。
- 部分接口依赖第三方服务，开发或打包后如果数据加载异常，请优先检查代理目标和网络可用性。
