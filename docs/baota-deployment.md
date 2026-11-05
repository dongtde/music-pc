# OpenCloudOS 9 + 宝塔 13 部署澜音

适用于已购买的 2 核 2GB 服务器。采用一个静态站点和一个常驻 Node.js 进程，每间房默认 10 人；前端、音乐接口代理和一起听通过同一个网站地址访问。

本指南默认继续使用本地已配置的酷狗、网易云音乐接口。`backend/` 只提供一起听，不包含这两套音乐 API 的服务端源码；若要把音乐 API 也迁到新服务器，需要另行取得和部署对应项目。

## 1. 本机生成上传包

在项目根目录运行：

```powershell
npm run build
```

网页资源输出在 `dist/`，服务器部署包输出在 `release/server/`。每次生成新的 `lanyin-baota-时间戳.tar.gz`，包含：

```text
lanyin/
  frontend/                  已构建的网页
  backend/                   一起听源码、依赖清单及 .env.example
  config/nginx-locations.conf 宝塔站点需要的路由及代理
  config/package-manifest.json
  DEPLOY.md                  本指南
```

构建过程从本地配置读取现有音乐 API 上游，写入只供 Nginx 使用的配置文件；网页只访问 `/api` 和 `/netease-api`。包中不包含开发机的 `.env`、登录凭据、Windows 依赖、Electron 或 Vercel 配置。后台发布包只保留 `start` 正式启动入口。临时解压目录放在 `node_modules/.cache/`，发布目录只输出压缩包。压缩包包含上游配置，保存在本地和自己的服务器即可。

## 2. 在宝塔安装运行环境

- 软件商店安装并启动 Nginx。
- 安装 Node.js 版本管理工具，安装 Node.js 22 或 24 LTS，并在项目中选择这个版本。
- 腾讯云实例防火墙和系统防火墙放行网站使用的 TCP 80；配置 HTTPS 后使用 TCP 443。一起听的 3030 端口仅供本机 Nginx 访问。

宝塔面板通过腾讯云控制台提供的入口登录。无需在聊天中提供面板密码或服务器私钥。

## 3. 上传和解压

在宝塔「文件」中进入 `/www/wwwroot/`，上传压缩包并解压，使最终路径为：

```text
/www/wwwroot/lanyin/frontend/index.html
/www/wwwroot/lanyin/backend/package.json
/www/wwwroot/lanyin/config/nginx-locations.conf
```

解压后核对目录层级，避免多出一层压缩包同名目录。后续网站根目录必须指向 `frontend`，这样后台源码和代理配置不会被作为网页文件提供。

## 4. 启动一起听后台

在宝塔终端中，确认当前 Node.js 版本至少为 22，然后执行：

```bash
node -v
cd /www/wwwroot/lanyin/backend
npm ci --omit=dev
```

首次部署时，在文件管理器将 `.env.example` 复制为 `.env`。该配置已将监听地址设为 `127.0.0.1:3030`、人数设为 10。确定网站地址后，可填写：

```dotenv
LISTENING_ALLOWED_ORIGINS=http://你的公网IP
LISTENING_PUBLIC_URL=http://你的公网IP
```

若使用 HTTPS 域名，两项都填对应的 `https://域名`。地址不包含 `/space` 或其他路径；修改配置后需要重启 Node 项目。

在宝塔「网站 → Node 项目」添加项目，按以下值配置（不同面板版本的字段名称可能略有区别）：

| 字段 | 值 |
| --- | --- |
| 项目名称 | `lanyin-listening` |
| 项目目录 / 工作目录 | `/www/wwwroot/lanyin/backend` |
| Node 版本 | 已安装的 22 或 24 LTS |
| 启动方式 | 选择 `package.json` 的 `start` 脚本，即 `npm start` |
| 自定义启动命令（若需要） | `node src/start.js` |
| 项目端口 | `3030` |
| 运行用户 | `www`，确保有项目目录的读写权限 |
| 进程模式 / 数量 | 单实例、1 个进程，关闭集群模式 |
| 开机启动 / 进程守护 | 开启 |

由下一步的静态站点统一转发请求，Node 项目保持本地监听即可。启动后在宝塔终端验证：

```bash
curl http://127.0.0.1:3030/health
```

应返回 `{"ok":true,"service":"lanyin-listening-room"}`。如果终端找不到正确版本的 `node` 或 `npm`，先在 Node 版本管理工具中设置默认版本，或使用该版本的终端。

## 5. 添加网页站点和代理

在宝塔「网站」添加纯静态 / HTML 站点。部分版本在「PHP 项目」入口添加，PHP 版本选择「纯静态」。

- 测试地址：填写服务器公网 IP；正式使用域名时，按云平台要求完成相关备案并解析至本机。
- 网站根目录：`/www/wwwroot/lanyin/frontend`。
- 在该网站的 Nginx 配置中，把下面一行加入现有的 `server { ... }` 内部：

```nginx
include /www/wwwroot/lanyin/config/nginx-locations.conf;
```

只修改这个网站的配置，保留宝塔已有的 `listen`、`server_name`、证书及验证目录设置。若已有 `location /`、相同路径的反向代理或伪静态规则，需要与上传的配置合并，确保同一路径只定义一次。

上传的配置已经提供：

| 路径 | 用途 |
| --- | --- |
| `/space` 等网页路由 | 回退到 `index.html`，刷新不会变成 404 |
| `/assets/` | 前端构建资源及缓存 |
| `/health` | 一起听健康检查 |
| `/listening-room/socket.io/` | WebSocket 转发，包含 Upgrade 请求头 |
| `/listening-room/rooms` | 房间列表 |
| `/api/` | 现有酷狗 API 上游，转发时去掉 `/api/` 前缀 |
| `/netease-api/` | 现有网易云 API 上游，转发时去掉 `/netease-api/` 前缀 |

HTTPS 音乐上游开启证书校验，CA 路径按 OpenCloudOS 9 配置为 `/etc/pki/tls/certs/ca-bundle.crt`。若 Nginx 检查提示这个文件不存在，先安装或更新系统 `ca-certificates` 包并确认其实际路径，保留证书校验。

保存前检查 Nginx 配置，成功后在面板中重载 Nginx：

```bash
/www/server/nginx/sbin/nginx -t
```

不要以 Vite 开发服务器作为正式网站进程；正式网页由 Nginx 提供。`vite.config.js` 中的代理只对开发和预览服务生效。

## 6. 验证前后端

1. 打开 `http://你的公网IP/space`，确认页面能打开，直接刷新也正常。
2. 打开 `http://你的公网IP/health`，确认 `ok: true`。
3. 打开 `http://你的公网IP/listening-room/rooms`，无房间时应返回 `rooms: []`。
4. 在网页中实际搜索、选择和播放歌曲，验证音乐上游及代理；查看 `/api/` 和 `/netease-api/` 请求，接口响应不应是前端 HTML。
5. 在一起听「连接设置」填写 `http://你的公网IP`，不要加 `:3030`、`/space` 或 `/health`；如使用 HTTPS 则填写 HTTPS 站点地址。清除或更改此前保存的 Vercel 后台地址。
6. 两台设备创建、发现和加入同一房间，分别加歌、暂停、切歌和拖动进度，连续验证至少 10 分钟。

开发者工具「网络 → 套接字」应看到 `/listening-room/socket.io/`。在打开网络面板之后重新连接，点击连接的「消息」可查看同步事件。

IP 的 HTTP 访问用于先验证连通性；正式使用时配置受信任的 HTTPS。若网页使用 HTTPS，其后端连接也使用 HTTPS/WSS。Node 服务经 Nginx 转发后，不再受 Vercel 的 300 秒函数时限限制；代理中 3600 秒是空闲读写超时，正常心跳会持续刷新该计时。

## 7. 更新与排查

- 更新代码后重新运行 `npm run build`，上传新的网页和后台源码，保留服务器自己的 `backend/.env`。后台依赖变化时重新执行 `npm ci --omit=dev`。
- 在宝塔重启 Node 项目；前端新版本有新的资源文件名，刷新页面生效。
- 当前房间仍在单个进程内存中。重启服务会结束已有房间，更新应安排在房间空闲时；保持单实例运行。
- 后台健康正常但网页搜索失败：检查音乐接口代理和上游是否允许新服务器访问。
- 页面能打开但一起听失败：检查 Node 日志、3030 本地健康检查、WebSocket 转发和弹窗里的连接地址。
- 不要把宝塔生成的 Node 项目反向代理覆盖到整个静态站点；网页、音乐接口和一起听各自按上述路径转发。

部署包在本地完成构建与打包，不表示已上传或已在服务器验证。以实际服务器的 Nginx 检查、健康接口和双设备试听结果为准。
