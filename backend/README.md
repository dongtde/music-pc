# 澜音一起听后端

这是可独立复制、安装和部署的 Node.js 项目，负责多人房间、成员权限、公共队列和播放时间线。默认每房间最多 10 人，所有成员均可点歌和控制播放，房主负责结束房间。它不导入前端文件，也不需要 Vue、Vite、Electron 或上级目录的依赖。

## 运行

需要 Node.js 22 或更新版本。在本目录执行：

```sh
npm ci
npm start
```

默认监听 `0.0.0.0:3030`。`npm run dev` 使用 Node 的 watch 模式；`npm test` 运行后端测试。

部署时只需复制整个 `backend/` 目录，执行 `npm ci --omit=dev` 和 `npm start`。无需复制前端 `src/`、`electron/` 或根目录的 `package.json`。服务只在内存保存房间，重启后房间会结束。

## Vercel 试运行

可以把同一 Git 仓库的 `backend` 目录作为单独的 Vercel 项目部署，或在本目录使用 Vercel CLI。无需为后端另建仓库。

`api/index.js` 导出 HTTP Server，由 Vercel 接管监听；`vercel.json` 把健康检查、房间目录和 WebSocket 路径统一转发到同一个函数，最长调用时间设为 300 秒。浏览器客户端已经使用直接 WebSocket 传输。`.vercelignore` 仅允许上传运行源码和依赖清单，不上传本地环境文件、测试或前端。

这是现有内存版的试运行入口，未接入 Redis。不同请求仍可能分配到不同实例，连接到期或实例重建后可能找不到房间；短时间连通不代表持续同步可用。需要验证创建与加入、目录更新、成员控制，以及超过 5 分钟后的重连和房间恢复。

2026-11-05 的云端试运行已复现约五分钟后的连接超时，且有客户端重连后丢失原房间。当前内存版未通过持续同步验证。仓库中的 `docs/vercel-listening-trial.md` 记录了部署地址和完整结论。

Vercel 项目需要启用 Fluid compute。供浏览器直接连接的部署域名不能要求 Vercel 登录；可以使用专门的测试项目生产域名，不修改已有前端项目的保护设置。部署后使用 `https://后端域名/health` 检查运行状态，在一起听面板的连接设置中填写 `https://后端域名`。

无需在 Vercel 设置监听端口。人数默认 10；可按需配置下方环境变量。未指定 `LISTENING_PUBLIC_URL` 时，Vercel 环境会使用项目的生产域名作为邀请地址。

在本地安装完整依赖后，可运行 `node scripts/probe-deployment.js https://后端域名 360`，用三个真实 WebSocket 客户端检查房间发现、共同加歌、控制、重连和超过五分钟的状态一致性。遇到连接中断时会额外等待最多 45 秒检查恢复，并区分房间丢失与需要手动恢复播放。探测仅发送测试歌曲元数据，不播放音频，结束后会尝试关闭自己创建的测试房间。

## 配置

将本目录 `.env.example` 复制为 `.env` 后修改，启动程序会读取这份文件。系统环境变量优先，不读取前端根目录的 `.env`。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `LISTENING_HOST` | `0.0.0.0` | 监听地址 |
| `LISTENING_PORT` | `3030` | 后端端口 |
| `LISTENING_ROOM_CAPACITY` | `10` | 每房间人数上限，包含房主；允许 2–50 的整数 |
| `LISTENING_ALLOWED_ORIGINS` | 空 | 可连接的前端来源，逗号分隔；空值方便局域网开发 |
| `LISTENING_PUBLIC_URL` | 空 | 可选的后端公网地址，用于邀请信息，例如 `https://listen.example.com` |

健康检查：`GET /health`。房间目录：`GET /listening-room/rooms`。Socket.IO 路径：`/listening-room/socket.io/`。

房间目录向连接本服务的客户端提供房间码、房主昵称、人数、当前歌曲名称及可加入状态，供「加入房间」自动查找。目录读取无需建立播放会话，遵循 `LISTENING_ALLOWED_ORIGINS` 配置并禁止缓存；完整队列、成员会话凭证与播放地址不进入目录。满员或房主重连中的房间仍显示状态，加入时另行检查名额。

修改人数上限后重启后端生效，前端根据服务器返回的上限显示人数。断线成员的位置保留 30 秒，期间仍计入人数。服务重启会结束已有房间；当前房间状态只存在单个进程内，部署时使用单实例。

公网部署时使用 HTTPS，并配置反向代理转发 WebSocket Upgrade 请求。填写 `LISTENING_ALLOWED_ORIGINS` 时使用浏览器页面的实际来源，包括协议和端口；Electron 客户端可能使用 `mappic://app` 来源。

## 前端如何连接

- 开发：前端 Vite 通过 `LISTENING_API_TARGET=http://127.0.0.1:3030` 转发 Socket.IO 请求。前端启动不会自动启动本服务。
- 独立部署：前端构建时配置 `VITE_LISTENING_SERVER_URL=https://listen.example.com`，或在一起听面板的「连接设置」填写后端地址。
- 同域部署：在前端站点反向代理整个 `/listening-room/` 到本服务，覆盖房间目录和 Socket.IO 路径，并转发 WebSocket Upgrade 请求，前端可以继续使用站点自身地址。

前后端使用 Socket.IO 消息协议，不通过跨目录 JavaScript 导入连接。修改协议字段时，需要同步调整前端的消息处理，并运行项目根目录的联调测试。

所有房间成员都可添加歌曲、切歌、播放、暂停、调整进度和播放模式。加歌在服务端合并，队列最多 200 首，满额时拒绝新增并保留原队列。替换或清空队列需携带最新的 `queueVersion`，防止覆盖其他人刚添加的歌曲；过期歌曲上的进度和上下首操作也会被拒绝。指令按成员去重，并由服务器按接收顺序处理。

## 目录

```text
backend/
├── src/
│   ├── start.js       # 启动与退出
│   ├── app.js         # HTTP 健康检查和服务实例
│   ├── config.js      # 后端环境配置
│   ├── rooms.js       # 房间与同步业务
│   └── protocol.js    # 后端校验与时间线计算
├── test/              # 后端测试及联调进程入口
├── .env.example
├── package.json
└── package-lock.json
```
