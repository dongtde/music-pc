# Mappic Music 极致优化方案

> 范围：本方案只做项目级优化设计，不修改现有代码。分析对象为当前仓库的 Vue 3 + Vite + Electron/PWA 音乐客户端。
>
> 优先级定义：
> - P0：必须先处理。影响功能可达性、核心播放链路、明显性能风险或后续优化基线。
> - P1：高收益优化。影响首屏、内存、接口并发、长列表、播放器体验。
> - P2：体验与维护性优化。降低重复代码、提升稳定性、减少未来缺陷。
> - P3：增强型优化。偏长期、锦上添花或需要更完整产品决策。

## 0. 优化进度

最近更新：2026-06-23

| 状态 | 优先级 | 模块 | 完成内容 |
| --- | --- | --- | --- |
| 已完成 | P0 | 路由 | 已接入 `/search`、`/search/:keyword`、`/fm`，修复搜索页和私人 FM 页面不可达问题 |
| 已完成 | P0 | 导航 | 已在侧边栏增加“搜索音乐”和“私人 FM”入口 |
| 已完成 | P0 | 应用壳 | 已将全局 `KeepAlive` 改为路由 `meta.keepAlive` 白名单，只保活 `home`、`discover`、`podcast` 系入口页 |
| 已完成 | P0 | 缓存 | 已新增通用 LRU 缓存工具，并为服务层、统一歌词服务、封面取色、MV 播放、MV 评论、排行榜曲目缓存设置容量上限 |
| 已完成 | P0 | 构建基线 | 已新增 `npm run baseline:bundle`，可输出 raw/gzip/brotli 和最大 JS/CSS chunk 报告 |
| 已完成 | P0 | 路由验证 | 已拆出 `src/router/routes.js` 路由表，并新增 `npm run smoke:routes`，覆盖 20 个路径解析和 17 个核心路由命名检查，当前 37/37 通过 |
| 已完成 | P0 | 首屏验证 | 已新增 `npm run smoke:first-screen`，通过 Electron smoke 模式打开 `mappic://app/#/home`，输出首屏截图和指标报告，当前 5/5 通过 |
| 已完成 | P0 | 首页性能 | 已新增 `npm run smoke:fps`，采样首页音乐/视频 feed idle、scroll、recovery FPS；视频 feed 已改为当前/相邻小窗口 hydration，当前 9/9 通过 |
| 已完成 | P0 | 服务层 | 已完成服务层与 API 大文件拆分：`src/services/netease.js` 由约 121.9KB 降至约 2.0KB 兼容出口；comments、lyrics、search、album、home、playlist、artist、mv、podcast、FM、喜欢状态、下载、榜单均已拆成 domain/子模块；`src/services/auth/` 已承接登录、session、VIP；`src/api/modules/netease.js` 由约 76.8KB 降至约 3.2KB 兼容出口，API 已拆到 auth/home/mv/podcast/user/playlist/charts/artist/album/comments/song/search 与 shared 子模块 |
| 部分完成 | P0 | 播放器 | 已从 `PlayerBar.vue` 抽出左侧歌曲摘要、播放模式、传输控制、音量、播放进度、弹幕开关、桌面歌词按钮、播放队列、音质、视觉效果弹层、歌曲动作按钮组件、桌面歌词桥接逻辑、进度条歌词预览、全屏弹幕评论流和当前歌曲评论弹窗/统计；已完成统一歌词服务、播放 URL LRU 缓存、队列来源与版本治理、音量单一来源和持久化、播放模式 store 化、当前歌曲评论数 stale 缓存、播放错误模型 |

## 1. 总体目标

本项目已经具备完整的音乐客户端雏形：沉浸式首页、发现页、电台、MV、歌单/专辑/歌手详情、资料库、全屏播放器、桌面歌词、登录与 VIP、Electron 自定义协议、PWA 缓存等。下一阶段的“极致优化”应分为三条主线同步推进：

1. 功能可达性和路由一致性：先保证已经实现的页面能够被访问，已经存在的页面不被路由吞掉，搜索、私人 FM 等入口闭环。
2. 性能基线和重页面治理：围绕首页、MV、播放器、发现页、电台、详情长列表建立性能指标，处理过度保活、长列表渲染、重复请求、动画/定时器泄漏。
3. 代码结构和服务层收敛：拆分超大文件、抽出共用查询/分页/弹幕/评论/播放器能力，减少重复逻辑，提高后续迭代速度。

建议目标指标：

| 指标 | 当前风险点 | 目标 |
| --- | --- | --- |
| 冷启动首屏可交互 | `App.vue` 全局 Shell + Naive UI + PlayerBar 常驻 | Web 首屏 2.0s 内，Electron 主窗口 2.5s 内可操作 |
| 路由切换耗时 | 全路由 `KeepAlive` 常驻，部分页面大组件 | 普通页面切换 < 120ms，重页面切换 < 250ms |
| 首页滚动 FPS | 首页音乐/MV feed、弹幕、歌词、视频并存 | 主流机器 55-60 FPS，低端机器不低于 45 FPS |
| 内存 | `KeepAlive` + 图片/视频/评论缓存 + Map 无上限 | 长时间使用后渲染进程稳定在可控范围，切页后重资源可释放 |
| 接口失败恢复 | 多处局部 catch，无统一重试/取消 | 可取消过期请求，失败有重试、降级和埋点 |
| 包体 | `services/netease.js`、`api/modules/netease.js`、大 CSS 文件 | 分页面加载，vendor/业务 chunk 结构清晰 |

## 2. P0 必做清单

| 状态 | 优先级 | 模块 | 问题 | 建议 |
| --- | --- | --- | --- | --- |
| 已完成 | P0 | 路由 | `SearchView.vue`、`SearchDetailView.vue` 已实现，但 `src/router/index.js` 没有 `/search` 与 `search-detail` 路由；`TopBar.vue` 只在浮层内搜索，独立搜索页不可达 | 已补齐 `/search` 与 `/search/:keyword` 路由，并增加侧边栏入口 |
| 已完成 | P0 | 路由 | `FMView.vue` 已实现，但 `/fm` 当前重定向到 `/podcast` | 已启用 `/fm` 页面，并增加侧边栏入口 |
| 已完成 | P0 | 应用壳 | `App.vue` 对所有路由统一 `KeepAlive`，会让重页面、视频、弹幕、评论缓存常驻 | 已改为 `meta.keepAlive` 白名单保活，详情、MV、设置、搜索等页面默认卸载 |
| 已完成 | P0 | 缓存 | `cacheStore`、首页歌词/封面取色、MV 播放/评论、排行榜曲目缓存原为无上限 Map，长时间使用会持续增长 | 已接入 `createLruCache`，服务层 160、统一歌词服务 96、封面取色 80、MV 播放 24、MV 评论 24、榜单曲目 20 |
| 部分完成 | P0 | 播放器 | `PlayerBar.vue` 体量大且承担全屏播放器、弹幕、歌词、评论、桌面歌词通信、音质、队列等多职责 | 已先抽出 `PlayerTrackSummary.vue`、`PlayerModePopover.vue`、`PlayerTransportControls.vue`、`PlayerVolumePopover.vue`、`PlayerProgressBar.vue`、`PlayerDanmakuToggle.vue`、`PlayerDesktopLyricsButton.vue`、`PlayerQueuePopover.vue`、`PlayerQualityPopover.vue`、`PlayerVisualizerPopover.vue`、`PlayerTrackActions.vue`、`useDesktopLyricsBridge.js`、`useProgressLyrics.js`、`useFullPlayerDanmakuComments.js` 和 `useCurrentTrackComments.js`；已新增 `src/services/lyrics.js` 统一歌词缓存/请求去重；已在 `src/stores/player.js` 增加播放 URL LRU 缓存、`queueSource`、`queueVersion`、音量持久化、播放模式持久化和按模式选曲 helper，并为首页、发现、搜索、FM、专辑、歌单、歌手、电台、资料库等入口补齐队列来源；`useCurrentTrackComments.js` 已增加评论数 stale 缓存 |
| 已完成 | P0 | 服务层 | `src/services/netease.js` 原超过 120KB，`src/api/modules/netease.js` 原约 76.8KB，业务聚合和协议适配混在一起 | 已保持兼容出口并完成原子化拆分：服务层根入口约 2.0KB，home/playlist/podcast/artist/mv 已继续拆到二级子模块，FM、喜欢状态、下载、榜单也已独立；API 根入口约 3.2KB，已拆到 auth/home/mv/podcast/user/playlist/charts/artist/album/comments/song/search，shared 已拆成 client/base/responses/search/playback/lyrics |
| 已完成 | P0 | 构建基线 | 当前没有性能预算、包体分析、Lighthouse/Playwright 回归基线 | 已补充包体基线命令 `npm run baseline:bundle`，并补齐路由 smoke、播放器 smoke、首屏 smoke、首屏截图和首页 FPS smoke；MV 独立页 FPS 后续继续补齐 |
| 部分完成 | P0 | Electron 安全/稳定 | 已将 `electron/main.cjs` 拆为薄入口，并抽出 `electron/protocolProxy.cjs`、`electron/desktopLyricsWindow.cjs`、`electron/smoke.cjs`、`electron/windowUtils.cjs`；媒体代理已增加 GET/HEAD 限制、Range 透传校验、敏感头剥离、内网地址拦截和可选 host 白名单 smoke | 后续继续补自定义协议/API 代理/桌面歌词 IPC 的 Electron smoke，完善 preload 参数校验 |

## 3. 全局架构优化

### 3.1 路由和页面生命周期

文件：`src/router/index.js`、`src/App.vue`

| 状态 | 优先级 | 项 | 方案 |
| --- | --- | --- | --- |
| 已完成 | P0 | 搜索路由 | 已添加 `/search` -> `SearchView.vue`、`/search/:keyword` -> `SearchDetailView.vue` |
| 已完成 | P0 | 私人 FM 路由 | 已将 `/fm` 从 redirect 改为 `FMView.vue`，并在侧边栏提供入口 |
| 已完成 | P0 | `KeepAlive` 策略 | 已给入口路由增加 `meta.keepAlive`，只保活 `home`、`discover`、`podcast` 系页面 |
| 已完成 | P0 | 路由表拆分 | 已新增 `src/router/routes.js` 导出路由表，`src/router/index.js` 只负责创建 router，便于 smoke 脚本复用和后续路由治理 |
| 待处理 | P1 | 路由 chunk 命名 | 用 `defineAsyncComponent` 或动态 import 注释保持页面 chunk 可读，便于 bundle 分析 |
| 待处理 | P1 | 页面预取 | 鼠标悬停侧边栏或首页卡片时预加载目标页 chunk，尤其 `playlist`、`artist`、`album` |
| 已完成 | P2 | 404 路由 | 已新增 catch-all `not-found` 路由和 `NotFoundView.vue`，非法路径不再空白，并纳入 `smoke:routes` |

### 3.2 状态和缓存

文件：`src/stores/player.js`、`src/stores/library.js`、`src/stores/auth.js`、`src/services/cache.js`

| 状态 | 优先级 | 项 | 方案 |
| --- | --- | --- | --- |
| 已完成 | P0 | 缓存上限 | 已新增 `src/utils/lruCache.js`，并限制 `cacheStore`、歌词、封面取色、MV 播放、MV 评论、排行榜曲目缓存容量；服务层 TTL 逻辑保持不变 |
| 部分完成 | P1 | 请求取消 | 搜索建议、顶部搜索结果、搜索详情结果、电台详情/节目分页、发现歌手筛选、发现歌单分类、专辑地区筛选、歌单详情/曲目分页、专辑详情、歌手详情/tab 分页、MV 首屏/筛选/播放详情/清晰度已接入 `AbortController`，旧请求会真正取消；FM、Podcast 等仍待继续推广 |
| 已完成 | P1 | 状态持久化节流 | `playerSnapshot` 已按秒节流；资料库 `persist()` 已加入 350ms 防抖，并在 pagehide/beforeunload/visibility hidden 时立即 flush，批量导入本地文件时减少 localStorage 写入 |
| 已完成 | P1 | 最近播放/喜欢列表 | 已新增 `src/composables/useVirtualRows.js`，并接入 `LibraryView.vue` 的本地/最近/喜欢歌曲列表，避免大量歌曲一次性渲染 |
| 部分完成 | P2 | 统一错误模型 | 播放器链路已新增 `src/utils/playbackError.js`，统一成 `code/userMessage/action/recoverable/details`；全站 API 错误模型仍待继续推广 |
| 已完成 | P2 | 账号/VIP 状态 | 已将 `auth.js` 中登录/QR API 适配拆到 `src/services/auth/login.js`，Cookie/session/请求身份构造拆到 `src/services/auth/session.js`，VIP 领取与状态解析拆到 `src/services/auth/vip.js`；`auth.js` 保留状态流转和 UI 行为协调 |

### 3.3 API 和服务层

文件：`src/api/http.js`、`src/api/modules/netease.js`、`src/services/netease.js`

| 优先级 | 项 | 方案 |
| --- | --- | --- |
| P0（已完成） | 拆分大文件 | `services/netease.js` 已拆为兼容出口，服务实现按 comments、lyrics、search、home、playlist、album、artist、mv、podcast、FM、喜欢状态、下载、榜单拆分；home/playlist/podcast/artist/mv 已继续拆成子模块与共享 mapper，服务层最大实现文件约 8.9KB。`api/modules/netease.js` 已拆为兼容出口，API domain 已落到 auth/home/mv/podcast/user/playlist/charts/artist/album/comments/song/search，shared 已拆为 client/base/responses/search/playback/lyrics。下一步进入 P1 请求取消/并发池/重试与 P2 normalizers 单测 |
| P1 | 并发池 | `getMusicFeedData`、`getVideoCenterData`、`getMvPlaybackData`、`getAlbumDetailData` 等多接口 `Promise.all` 加并发限制和超时分级 |
| P1 | 缓存 key 标准 | 所有分页接口 key 包含 `limit/offset/filter/authIdentity`，评论与歌词区分游客/登录态 |
| P1 | 重试策略 | 对可重试网络错误做指数退避，业务错误不重试；评论/弹幕可静默降级 |
| P2 | 数据 normalize | song、playlist、album、artist、mv、podcast 的 normalize 从服务层抽到 `normalizers/`，并单测覆盖 |
| P2 | 接口监控 | 增加轻量日志钩子，记录接口耗时、失败率、缓存命中率 |

### 3.4 构建和包体

文件：`vite.config.js`、`package.json`

| 状态 | 优先级 | 项 | 方案 |
| --- | --- | --- | --- |
| 已完成 | P0 | 包体分析 | 已增加 `scripts/analyze-bundle.cjs` 和 `npm run baseline:bundle`，输出 `reports/performance/bundle-baseline.json` 与 `.md`，覆盖 raw/gzip/brotli 和 chunk 排名 |
| 待处理 | P1 | vendor chunk | 现有 `manualChunks` 已拆 Naive UI、icons、axios；继续将 `PlayerBar/FullScreenPlayer/DanmakuLayer` 相关重功能懒加载 |
| 待处理 | P1 | CSS 拆分 | `discover.css`、`podcast.css`、`main.css`、`player.css` 体量较大，改为页面局部 CSS 或按功能拆分 |
| 待处理 | P2 | 图标按需 | lucide 已按组件 import，但检查是否存在重复大批量图标导入，播放器和发现页可拆组件降低首屏 |
| 待处理 | P2 | PWA 缓存版本 | `public/sw.js` 当前固定 `v1`，建议构建时注入版本，避免用户长期拿旧资源 |

## 4. 每个页面优化方案

### 4.1 首页 `/home`

文件：`src/views/HomeView.vue`、`src/views/home/HomeMusicFeed.vue`、`src/views/home/HomeVideoFeed.vue`、`src/views/home/useHomeMusicFeed.js`、`src/views/home/useHomeVideoFeed.js`

当前功能：
- 音乐 feed：竖向沉浸滚动、歌词、弹幕、评论、喜欢、播放进度、封面取色。
- 视频 feed：竖向 MV 流、播放地址缓存、视频弹幕、评论、喜欢。

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P0（部分完成） | 页面保活 | 已完成：视频 feed 只 hydration 当前/相邻范围内的重内容，保留轻量 slide 作为滚动占位；`npm run smoke:fps` 验证 home-video hydrated 小窗口通过。待处理：离开首页时继续审计视频释放和弹幕定时器 |
| P1 | 音乐 feed 渲染 | 现有 `SLIDE_HYDRATE_RADIUS = 2` 已做局部渲染，建议把图片、歌词、弹幕、进度条也按 active/adjacent 分层挂载 |
| P1（已完成） | 封面取色 | `sampleCoverTint` 已加入跨页面 LRU 成功缓存、失败缓存、同 URL pending 复用和 2 并发队列，调用端 API 保持不变 |
| P1（已完成） | 弹幕 | 首页音乐和首页 MV 弹幕评论首批已从 80 降到 30，同时可见弹幕池从 48 降到 36，保留接近耗尽时自动补下一页 |
| P1（已完成） | 键盘事件 | `useHomeMusicFeed` 与 `useHomeVideoFeed` 已按 active 状态绑定/解绑全局空格键监听，并加重复绑定 guard；切 tab 和 KeepAlive 激活时只保留当前 feed 监听 |
| P1 | 自动播放 | 滚动后 `autoPlayAfterGesture` 自动播放应记录用户手势来源，避免路由返回后意外播放 |
| P2 | 代码复用 | 音乐 feed 和 MV feed 的 drag/snap/scroll 逻辑可抽 `useVerticalSnapFeed` |
| P2 | 评论/弹幕复用 | `useHomeSongEngagement`、`useHomeMvEngagement` 与播放器弹幕逻辑收敛为 `useDanmakuComments` |
| P3 | 低性能模式 | 设置里提供“减少动画/关闭弹幕/关闭封面取色”，低端设备显著降耗 |

验收：
- 首页音乐与视频 tab 来回切换 20 次，无持续增长的 video/audio/interval/timer。
- 36 条推荐列表滚动稳定，非 active slide 不加载歌词和评论。

### 4.2 发现页 `/discover/:tab?`

文件：`src/views/DiscoverView.vue`

当前功能：tab 组件动态加载，`latest` 被映射到 `albums`。

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1 | tab 生命周期 | 每个 tab 是否保活需要明确。推荐页可保活；歌单、歌手、专辑筛选页可缓存最后查询；排行榜可缓存 |
| P1 | tab 路由 | `latest` 显示为专辑且指向 `AlbumsTab`，同时存在 `LatestTab.vue` 但未使用；明确保留或删除 |
| P2 | 异步组件状态 | `defineAsyncComponent` 增加加载/错误占位，慢网时避免空白 |
| P2（已完成） | tab 预加载 | `DiscoverView` 进入后会在 idle 时间预加载 playlists/charts tab chunk，失败时允许下次重试 |

#### 4.2.1 推荐 tab `/discover/recommend`

文件：`src/views/discover/RecommendTab.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1（已完成） | 首页聚合接口 | `getHomeDiscoverData` 已改为 banner、playlist、newsong、mv、radio 分区缓存和分区超时降级；单区块慢/失败时先返回空数据，后台成功后写入分区缓存 |
| P1（已完成） | 轮播 | `heroTimer` 已在 RecommendTab activated 时恢复、deactivated/unmounted 时暂停，避免 KeepAlive 隐藏后继续后台轮播 |
| P1（已完成） | 歌单轮播 | 推荐页歌单轮播已改为 `ResizeObserver` 观察页面容器宽度，并通过 CSS 变量统一轨道列宽与 JS 翻页列数 |
| P1（已完成） | 播放推荐歌单 | `PlaylistCard` 已在 hover/focus 时预取歌单 tracks，并与点击播放共享同一个 pending 请求，预取失败静默降级 |
| P2 | 骨架屏 | 当前骨架很完整，建议与真实卡片尺寸完全一致，降低 CLS |
| P2 | 图片 | banner/歌单/MV 封面统一接入尺寸参数和占位色 |

#### 4.2.2 歌单 tab `/discover/playlists`

文件：`src/views/discover/PlaylistsTab.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1（已完成） | 分页 | 已将 `PLAYLIST_LIMIT` 从 50 降到 30，首屏减量后继续用滚动加载补齐 |
| P1 | 分类弹窗 | 分类弹窗 Teleport 到 body，需补焦点锁定、关闭后焦点回到按钮 |
| P1（已完成） | 无限加载 | 已用 `useLoadMoreTrigger` + `AbortController`，切分类、重试或卸载会取消旧列表请求，Abort 不进入错误 UI |
| P2（已完成） | 分类缓存 | 已新增页面级 LRU 分类缓存，保存已加载歌单、分类元信息、offset 和 hasMore；切回分类时直接恢复，重试强制刷新 |
| P2 | 去重 | `mergePlaylists` 已做 ID 去重，建议将通用去重工具复用到其他页 |

#### 4.2.3 排行榜 tab `/discover/charts`

文件：`src/views/discover/ChartsTab.vue`

| 状态 | 优先级 | 功能 | 具体优化 |
| --- | --- | --- | --- |
| 已完成 | P1 | 榜单详情预取 | 已新增 idle 预取首屏 3 个榜单，并在播放按钮 hover/focus 时预取；预取和点击播放共享 pending 请求，避免重复拉详情 |
| 已完成 | P1 | 缓存容量 | 已将 `chartTrackCache` 改为 LRU 20 个榜单 |
| 已完成 | P2 | 播放状态 | `playingChartId` 已统一按字符串比较，播放按钮禁用态和高亮态一致 |
| 已完成 | P2 | 图片 | 小榜单封面已补 `sizes`，并显式固定真实图和占位图的 1:1 aspect-ratio |

#### 4.2.4 歌手 tab `/discover/artists`

文件：`src/views/discover/ArtistsTab.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1（已完成） | 筛选请求 | 切换 area/type/initial 或卸载歌手 tab 时会取消旧请求，Abort 错误不进入错误 UI，避免快速点击导致过期响应 |
| P1 | 列表渲染 | `ARTIST_LIMIT = 32` 可接受，但长滚动后应虚拟化或分页卸载旧节点 |
| P2（已完成） | 筛选缓存 | 已新增 area/type/initial 页面级 LRU 缓存，保存已加载列表、热榜、offset 和 hasMore；切回筛选组合时直接恢复，重试会强制刷新 |
| P2 | 筛选项 | initial 只显示 A-J，若 API 支持全字母，应提供更多或横向滚动 |
| P2 | 热榜歌手 | `topArtists` reset 失败时保留旧数据，需标记“旧数据”或按策略清空 |

#### 4.2.5 专辑 tab `/discover/albums`

文件：`src/views/discover/AlbumsTab.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1（已完成） | 首屏 | `ALBUM_LIMIT` 已从 36 降到 24，首屏 skeleton 从 18 降到 12；继续复用 `useLoadMoreTrigger` 靠近底部滚动补齐 |
| P1（已完成） | 地区请求 | 切换地区、重试或卸载 tab 会取消旧专辑请求，Abort 不进入错误 UI |
| P1 | 滚动 root | 已通过 `getRoot` 指向 `.view`，统一到 `useLoadMoreTrigger` 的模式 |
| P2 | 热碟 | `topAlbums` 与列表并发加载，失败分区展示 |
| P2（已完成） | 地区缓存 | 已新增页面级 LRU 缓存，保存已加载专辑、热碟、offset、total 和 hasMore；切回地区时直接恢复，重试强制刷新 |
| P2 | 图片 | 专辑封面 hover meta 可延迟挂载，减少卡片 DOM |

#### 4.2.6 最新音乐 tab

文件：`src/views/discover/LatestTab.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P0 | 可达性 | 文件存在但 `DiscoverView.vue` 把 `latest` 映射到 `AlbumsTab.vue`；决定是否启用 |
| P1 | 数据源 | 当前使用静态 `data/music`，若启用需接 API 和分页 |
| P2 | 组件复用 | 新歌列表应复用 `SongListRow` 和 `useQueuePlayback`，不要维护另一套 song-row |

### 4.3 电台页 `/podcast`、`/podcast/rank`、`/podcast/sleep`、`/podcast/radio`

文件：`src/views/PodcastView.vue`

当前功能：一个组件承载电台首页、榜单、乐库、全部电台；包含骨架屏、分类分页、榜单切换、推荐歌曲播放。

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1 | 组件拆分 | 将 overview/rank/library/radio 拆为 4 个子组件，保留共享 composable |
| P1 | 首页加载 | `loadHome()` 一次拉完整电台首页数据，建议分区加载：showcase、rank、category、library |
| P1（已完成） | 分类自动加载 | 已复用 `useLoadMoreTrigger` 管理分类 sentinel，切分类/离开页面会清理触发器并用 requestId + AbortController 忽略旧响应 |
| P1 | `KeepAlive` key | `App.vue` 通过 `getRouteViewKey` 保持 podcast tabs 同实例，这很好；拆分后仍需保留 tab 状态 |
| P2（已完成） | rank 切换 | `loadRank` 已加页面级 LRU 8 条缓存，首页 hot 榜也会写入缓存，切换榜单不重复请求/计算 |
| P2 | 列表密度 | `PodcastCard` 内联 defineComponent，可抽独立组件，便于懒加载图片和统一样式 |

### 4.4 电台详情 `/podcast/:id`

文件：`src/views/PodcastDetailView.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1（已完成） | 节目列表 | 已接入 `useVirtualRows`，继续加载后只渲染可见节目和缓冲行，播放队列仍使用完整已加载列表 |
| P1（已完成） | 自动加载 | 已复用 `useLoadMoreTrigger`，靠近底部自动加载下一页，同时保留“加载更多”按钮作为 fallback |
| P1（已完成） | 路由切换 | `loadDetail()` 和节目分页已接入 `AbortController` + requestId，切换电台或卸载页面会取消旧请求并忽略过期响应 |
| P2 | 播放全部 | `playAll()` 只播放第一首并设置当前已加载队列，若 total 较大可提示“先播放已加载节目” |
| P2 | 评论/订阅 | 服务层已有节目评论/订阅 API，详情页可按需补完整功能 |

### 4.5 MV/视频页 `/mv`、`/video`

文件：`src/views/VideoView.vue`

当前功能：推荐/视频库、筛选、无限加载、观看模式、视频控制、清晰度、画中画、全屏、弹幕、评论、收藏、点赞。

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P0（已完成） | 离开页面释放 | 已新增 `releaseActiveVideo()`，切 MV、返回浏览页、路由离开、组件失活或卸载时会暂停视频、清空 `video.src` 并调用 `load()` 释放媒体资源 |
| P1（已完成） | 请求取消 | MV 首屏、视频库筛选分页、播放详情和清晰度切换均已接入 `AbortController` + requestId；离开、切 MV、切筛选或重复切清晰度时会取消旧请求并忽略过期响应 |
| P1 | 组件拆分 | 拆为 `MvBrowseView`、`MvWatchView`、`MvControls`、`MvLibraryGrid`、`MvComments` |
| P1（已完成） | 无限加载 | 已改为复用 `useLoadMoreTrigger` + sentinel，移除页面根节点手动 scroll 检测，列表加载完成和切回视频库后会重新 setup/check |
| P1（已完成） | 视频播放地址 | 已新增 `getMvPlaybackUrlData()`；清晰度切换只拉播放地址并复用当前 MV 的详情、评论、相似视频和状态数据 |
| P1（已完成） | 弹幕评论 | 弹幕补充批次已从 80 降到 24，首屏继续复用播放详情中的 12 条轻量评论，后续由弹幕层按需触发补齐 |
| P1（已完成） | 内存 | 视频库 `filteredMvs` 已按响应式网格行窗口化，只渲染可视区附近行；`useVirtualRows` 已支持动态行高，窗口 resize 后会重新测量 |
| P2（已完成） | 控制条 | 播放舞台已改为 `pointermove` 节流刷新隐藏定时器，连续移动时最多每 350ms reset 一次 timer |
| P2（已完成） | 错误恢复 | 视频播放失败会显示恢复浮层，支持重新获取播放地址、切到备用清晰度、外部打开；自动播放被拦截只保留普通提示，不触发恢复浮层 |
| P3（已完成） | 预加载 | 观看当前 MV 时会延迟预取队列下一条的播放地址和 poster；预取限制为单 pending + LRU 8 条，切 MV/离开页面会取消旧预取，播放下一条时复用已预取地址 |

### 4.6 私人 FM `/fm`

文件：`src/views/FMView.vue`

当前状态：页面完整，`/fm` 路由和侧边栏入口已接入。

| 状态 | 优先级 | 功能 | 具体优化 |
| --- | --- | --- | --- |
| 已完成 | P0 | 路由可达 | 已启用 `/fm` 页面，侧边栏已增加入口 |
| 待处理 | P1 | FM 批量请求 | `FM_FETCH_LIMIT = 3` 会并发 3 次 `getPersonalFmData`，建议并发池 + 失败降级，避免接口压力 |
| 待处理 | P1 | 队列补水 | `LOW_QUEUE_WATERMARK = 2` 合理，但 `skipToNext` 触发补水时应防重入 |
| 待处理 | P1 | 喜欢状态 | 每批歌曲调用 `getSongLikeStateData`，可批量缓存；喜欢操作乐观更新失败回滚 |
| 待处理 | P2 | 登录态 | 未登录展示登录面板已清晰；登录后首次加载需显示 FM 模式恢复 |
| 待处理 | P2 | 不想听 | 移入垃圾桶后应立即播放下一首，同时保留撤销入口 |

### 4.7 歌单详情 `/playlist/:id`

文件：`src/views/PlaylistDetailView.vue`

当前亮点：已实现虚拟列表，初始 60 首，分页 100 首。

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1（已完成） | 虚拟列表复用 | 已抽 `src/composables/useVirtualRows.js`，并复用到 `PlaylistDetailView.vue`、`LibraryView.vue`、`AlbumDetailView.vue`、`ArtistDetailView.vue` 歌曲 tab、`SearchDetailView.vue` 歌曲结果和 `PodcastDetailView.vue` 电台节目 |
| P1（已完成） | 播放全部 | `loadAllRemainingTracks()` 已取消 `limit: total` 全量拉取，改为复用分页接口按 `PLAYLIST_TRACK_PAGE_SIZE` 分批补齐 |
| P1（已完成） | 路由切换取消 | 歌单详情首屏、曲目分页和播放全部补齐流程已接入 `AbortController` + token，路由切换/卸载会取消网络并清理 `activeTrackRequest` |
| P1（已完成） | 行高假设 | 已将 `SongListRow.vue` 普通行锁定为 58px、compact 行锁定为 52px，虚拟列表行高假设与 CSS 一致；后续可补视觉回归 |
| P2 | 本地歌单 | 本地歌单没有远程评论和封面，增加本地封面生成/首曲封面 |
| P2 | 评论 | 已用 `usePaginatedComments`，可统一滚动加载和错误重试 |

### 4.8 专辑详情 `/album/:id`

文件：`src/views/AlbumDetailView.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1（已完成） | 歌曲列表 | 专辑曲目已接入 `useVirtualRows`，大专辑/合集只渲染可见行和缓冲行 |
| P1（已完成） | 请求取消 | `loadAlbumDetail` 已接入 `AbortController` + requestId，切换专辑或卸载页面会取消旧请求并忽略过期响应 |
| P2（已完成） | 评论加载 | 已取消进入页面即 `commentState.load`，改为打开评论弹窗时懒加载；弹窗打开状态下切换专辑才刷新评论 |
| P2（已完成） | 封面 | hero 封面已改为 `loading="eager"` + `fetchpriority="high"`；详情曲目复用 `SongListRow`，封面保持 lazy |
| P2 | 描述 Tooltip | 长描述 tooltip 可按需挂载，避免移动端 hover 不适配 |

### 4.9 歌手详情 `/artist/:id`

文件：`src/views/ArtistDetailView.vue`

当前功能：精选、歌曲、专辑、视频、详情 tab，分页和加载更多。

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1 | 组件拆分 | 拆 `ArtistHero`、`ArtistSongsTab`、`ArtistAlbumsTab`、`ArtistVideosTab`、`ArtistIntroTab` |
| P1（已完成） | 精选预加载 | 精选专辑、视频、简介预览已改为 `requestIdleCallback`/fallback timer 低优先级调度，主详情和热门歌曲先渲染；切换歌手或卸载会取消 pending 预加载 |
| P1（已完成） | 歌曲列表 | `artistSongs` 已接入 `useVirtualRows`；精选热门歌曲数量较小，保留直接渲染 |
| P1（已完成） | 分页取消 | 歌手详情主请求和歌曲/专辑/视频/简介 tab 已接入 `AbortController` + requestId，歌手 id 或排序切换时会取消旧请求并忽略过期响应 |
| P2（已完成） | tab 缓存 | 已新增页面级 LRU 缓存，歌曲按 artistId + order，专辑/视频/简介按 artistId 保存已加载状态、分页游标和 hasMore；缓存命中时取消旧请求并直接恢复 |
| P2 | loading 最短时间 | `ARTIST_TAB_SKELETON_MIN_MS` 可按网络实际耗时动态，不强制慢设备等待 |

### 4.10 资料库 `/library/:type`

文件：`src/views/LibraryView.vue`、`src/stores/library.js`

支持类型：`local`、`recent`、`liked`。

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1（已完成） | 列表虚拟化 | 本地/最近/喜欢歌曲已复用 `useVirtualRows`，只渲染可见行和缓冲行 |
| P1 | 本地文件对象 URL | `URL.createObjectURL(file)` 后持久化时丢弃 URL，刷新后本地文件无法播放；需要 File System Access 或明确提示重新导入 |
| P1 | 下载同步 | `getDownloadedSongsData({ limit: 100 })` 只同步 100 首；增加分页同步与进度 |
| P2 | localStorage 容量 | 大量本地 tracks 写入 localStorage 可能超限；迁移 IndexedDB |
| P2 | 去重 | 本地文件按 name/size/lastModified 去重合理，但远程下载歌曲应按 id/hash 去重 |
| P3 | 音频元数据 | 本地文件可解析 ID3 获取歌手/专辑/时长/封面 |

### 4.11 搜索页 `/search` 与搜索详情

文件：`src/views/SearchView.vue`、`src/views/SearchDetailView.vue`、`src/components/TopBar.vue`

当前状态：独立搜索页与搜索详情页路由已接入；TopBar 内置完整搜索浮层。

| 状态 | 优先级 | 功能 | 具体优化 |
| --- | --- | --- | --- |
| 已完成 | P0 | 路由接入 | 已补 `/search`、`/search/:keyword`，现有 `router.push({ name: 'search' })` 和 `search-detail` 目标可解析 |
| 部分完成 | P1 | 搜索逻辑复用 | 已新增 `src/composables/useSearch.js`，复用搜索启动数据、历史记录、建议请求和热度格式化；完整结果分页逻辑仍保留在详情页 |
| 已完成 | P1 | 请求取消 | 搜索建议、顶部浮层结果、搜索详情结果已通过 `AbortController` 取消旧请求，服务层/API 已打通 `signal` |
| 待处理 | P1 | 结果分页 | `SearchDetailView` 有手动加载更多，TopBar 只查第一页；明确浮层只预览，完整结果进详情页 |
| 待处理 | P2 | 历史存储 | 三处都读写同一个 `STORAGE_KEYS.searchHistory`，统一 API |
| 待处理 | P2 | 空状态 | 搜索失败、无结果、默认词缺失统一视觉和文案 |

### 4.12 设置 `/settings`

文件：`src/views/SettingsView.vue`、`src/stores/theme.js`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1 | 动画偏好 | 尊重 `prefers-reduced-motion`，主题切换、队列动画、全屏播放器动画可关闭 |
| P1 | VIP 状态 | 设置页和侧边栏重复解析 SVIP，抽 `useVipStatus` |
| P2 | 配置分组 | 主题、播放器、歌词、账号/VIP 分区；未来加入低性能模式 |
| P2 | 颜色校验 | 自定义色写入前已 normalize，建议加入对比度检查 |
| P3 | 设置导入导出 | localStorage 偏好可导出/恢复 |

### 4.13 桌面歌词 `/desktop-lyrics`

文件：`src/views/DesktopLyricsView.vue`、`electron/main.cjs`、`electron/preload.cjs`、`src/components/PlayerBar.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P0 | IPC 频率 | 已抽 `useDesktopLyricsBridge.js` 封装桌面歌词 200ms 状态发布、seek 立即发布、IPC 命令监听和卸载清理；后续在 Electron smoke 中验证 payload 与 CPU |
| P1 | 窗口置顶 | `electron/main.cjs` 有 1200ms top guard 和多次 elevate，需验证 CPU 影响并按平台降级 |
| P1 | 拖拽 | drag move 走 IPC 高频通道，继续保持 rAF 节流，增加异常窗口边界处理 |
| P1（已完成） | 歌词缓存 | 已新增 `src/services/lyrics.js`，桌面歌词、全屏歌词、首页歌词、进度条预览统一走 `getCachedTrackLyrics`，共享 LRU 96 和请求去重 |
| P2 | 设置持久化 | 字号/颜色已有 localStorage，增加锁定状态/窗口位置持久化 |
| P2 | 无 Electron 环境 | Web/PWA 下隐藏入口已部分处理，保留所有桌面 API guard |

### 4.14 朋友页 `/friends`

文件：`src/views/SimpleView.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P2 | 产品决策 | 当前是占位页，若短期不做社交，隐藏入口或标记 Beta |
| P2 | 占位体验 | 避免跳到 `discover/recommend` 作为唯一动作，可给“返回上一页” |
| P3 | 社交功能 | 后续再接动态、关注、分享歌单等 |

## 5. 核心功能优化方案

### 5.1 播放器

文件：`src/stores/player.js`、`src/components/PlayerBar.vue`、`src/components/FullScreenPlayer.vue`

| 状态 | 优先级 | 功能 | 具体优化 |
| --- | --- | --- | --- |
| 部分完成 | P0 | 职责拆分 | 已抽出左侧歌曲摘要、播放模式、传输控制、音量、播放进度、弹幕开关、桌面歌词按钮、播放队列、音质、视觉效果、歌曲动作按钮 11 个 UI 子组件，并抽出 `useDesktopLyricsBridge.js`、`useProgressLyrics.js`、`useFullPlayerDanmakuComments.js`、`useCurrentTrackComments.js` 和 `src/services/lyrics.js`；播放 URL、队列来源、音量归一、播放模式 store 化、评论数 stale 缓存、播放器错误模型、`npm run smoke:player` 已完成 |
| 已完成 | P1 | 播放 URL 解析 | `src/stores/player.js` 已为 `resolvePlaybackUrl` 增加 LRU 80、8 分钟 TTL 缓存，缓存键包含 trackId、hash、album/audio id、quality 和 auth 身份；只缓存成功解析的 URL |
| 已完成 | P1 | 队列来源 | `setQueue(tracks, source)` 已记录 `queueSource` 与递增 `queueVersion`；首页音乐 feed 避免后台刷新覆盖其他页面队列，首页、发现、搜索、FM、专辑、歌单、歌手、电台、资料库等入口已补齐来源 |
| 已完成 | P1 | 播放模式 | `src/stores/player.js` 已新增 `playMode`、`setPlayMode`、`getRelativeQueueTrack`、`shouldRestartCurrentTrackOnEnded` 和 `STORAGE_KEYS.playerPlayMode`；`PlayerBar.vue` 只保留图标/弹层 UI |
| 已完成 | P1 | 音量 | `PlayerBar.vue` 已改为通过 computed 读写 `player.state.volume`，`src/stores/player.js` 负责音量 clamp、Audio 同步和 `STORAGE_KEYS.playerVolume` 持久化 |
| 已完成 | P1 | 全屏歌词 | `FullScreenPlayer.vue`、进度歌词、桌面歌词、首页歌词已统一到 `src/services/lyrics.js` |
| 已完成 | P2 | 评论数 | `useCurrentTrackComments.js` 已增加 120 条 LRU stale 缓存；切歌时先应用已知评论数，后台刷新成功后更新缓存，失败时保留旧值并暴露 `statsStale`/`statsError` |
| 已完成 | P2 | 错误提示 | 已新增 `src/utils/playbackError.js`，区分 `NO_PLAYBACK_URL`、`QUALITY_UNAVAILABLE`、`NETWORK`、`MEDIA_ERROR`、`AUTOPLAY_BLOCKED`、`LOCAL_FILE_MISSING`；`PlayerBar`、首页、发现、搜索、FM、歌单、歌手、电台等播放入口统一展示 `message + action` |

### 5.2 歌词

文件：`src/utils/lyrics.js`、`src/views/home/useHomeLyrics.js`、`src/components/LyricsScroller.vue`、`src/components/FullScreenPlayer.vue`、`src/views/DesktopLyricsView.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1（已完成） | 缓存统一 | 已建立 `src/services/lyrics.js`，所有页面共享同一 LRU 缓存和请求去重 |
| P1 | KRC/逐字歌词 | `getLyricWordState` 已支持逐字，确保全屏/桌面/首页行为一致 |
| P1 | seek | 歌词 seek 后立即发布桌面歌词状态，避免桌面歌词延迟 |
| P2 | 大歌词文件 | 对超长歌词预处理为时间索引，避免每帧过多计算 |
| P2 | 翻译歌词 | 若数据有 translation，统一显示策略 |

### 5.3 评论和弹幕

文件：`src/components/CommentModal.vue`、`src/components/DanmakuLayer.vue`、`src/composables/useSongComments.js`、`src/composables/usePaginatedComments.js`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1 | 评论弹窗虚拟化 | 评论多时 `CommentModal.vue` 直接渲染全部，需虚拟化或分页卸载 |
| P1 | 弹幕数据量 | 多处一次拉 80 条，首屏降低，按弹幕消耗补齐 |
| P1 | 定时器清理 | `DanmakuLayer.vue` timer 多，需用自动化测试覆盖启停/切歌/关闭弹幕 |
| P2 | 通用评论状态 | `useSongComments` 和 `usePaginatedComments` 合并为支持任意 resource 的通用 hook |
| P2 | 头像图片 | 弹幕头像可只在热门/近屏显示，减少 image 请求 |
| P3 | 弹幕性能模式 | CSS 动画保留，低性能模式只显示精选评论，不持续滚动 |

### 5.4 登录、账号、VIP

文件：`src/stores/auth.js`、`src/components/LoginModal.vue`、`src/components/SidebarNav.vue`、`src/views/SettingsView.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1 | QR 轮询 | `LoginModal.vue` 每 2200ms 轮询，隐藏/切 tab 已停止；增加页面不可见暂停 |
| P1 | VIP 自动领取 | `auth.initAuth()` 登录后自动 claim，需确认产品和接口频率，避免用户不知情请求 |
| P1 | Cookie 安全 | 本地存储 Cookie，Electron 下可考虑 OS keychain；Web 下至少增加过期和清除策略 |
| P2（已完成） | 逻辑拆分 | 登录/QR API 适配、Cookie/session/请求身份构造、VIP 领取与状态解析已拆到 `src/services/auth/login.js`、`src/services/auth/session.js`、`src/services/auth/vip.js` |
| P2 | 逻辑复用 | SVIP 判断在设置页、侧边栏重复；抽统一函数 |
| P2 | 错误恢复 | 登录失败给出验证码/扫码/Cookie 三种恢复路径 |

### 5.5 本地资料库

文件：`src/stores/library.js`、`src/views/LibraryView.vue`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1 | IndexedDB | localStorage 不适合大量歌曲和歌单，迁移资料库数据到 IndexedDB |
| P1 | 本地音频持久化 | object URL 刷新失效，明确使用 File System Access 或提示重新导入 |
| P2 | 批量导入 | 导入时分批 normalize + 持久化，显示进度 |
| P2 | 歌单操作 | 创建、添加、删除歌单 API 和本地数据要统一同步策略 |

### 5.6 Electron 桌面能力

文件：`electron/main.cjs`、`electron/preload.cjs`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P0（部分完成） | 模块拆分 | 已拆 `protocolProxy`、`desktopLyricsWindow`、`windowUtils`、`smoke`；`cookieJar` 当前随 API 代理留在 `protocolProxy` 内，后续可继续独立 |
| P1（部分完成） | 媒体代理 | `/media?url=` 已限制 GET/HEAD、HTTP(S)、敏感头剥离、内网 host 拦截、可选 host 白名单，并通过 `npm run smoke:electron-proxy` 校验 Range 透传；后续补真实媒体 206/4xx/5xx Electron smoke |
| P1 | API 代理 | cookie jar 当前内存 Map，重启丢失但安全；确认是否需要持久化 |
| P1 | 安全 | 保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`，为 preload API 加参数校验 |
| P2 | 窗口状态 | 主窗口大小、桌面歌词位置/锁定状态持久化 |

### 5.7 PWA 和缓存

文件：`src/registerServiceWorker.js`、`public/sw.js`

| 优先级 | 功能 | 具体优化 |
| --- | --- | --- |
| P1 | 缓存版本 | APP_CACHE/RUNTIME_CACHE 不应手写 v1；构建时注入 hash |
| P1 | runtime 限额 | 图片/脚本/style 缓存无数量限制，加入 LRU 清理 |
| P1 | API 策略 | 当前跳过 `/api`，合理；可对搜索热词/发现页做应用层缓存，不放 SW |
| P2 | 更新提示 | 新 SW 安装后通知用户刷新 |

## 6. 代码质量和维护性

### 6.1 优先拆分文件

| 优先级 | 文件 | 原因 | 拆分方向 |
| --- | --- | --- | --- |
| P0 | `src/services/netease.js` | 已从约 122KB 降至约 2.0KB；根入口只做 re-export，FM/喜欢/下载/榜单和各业务 domain 已拆分，home/playlist/podcast/artist/mv 已继续子模块化 | 已完成；后续转入 normalizers 与请求治理 |
| P0 | `src/api/modules/netease.js` | 已从约 76.8KB 降至约 3.2KB；auth/home/mv/podcast/user/playlist/charts/artist/album/comments/song/search 和 shared 子模块已完成拆分 | 已完成；后续补 API normalizer/cacheKey/error 单测 |
| P0 | `src/components/PlayerBar.vue` | 约 51KB，核心复杂度最高 | 控制区、队列、音质、评论、桌面歌词 |
| P1 | `src/views/VideoView.vue` | 约 39KB，浏览/播放双模式 | browse/watch/control/comment |
| P1 | `src/views/PodcastView.vue` | 约 32KB，多页面复用一个组件 | overview/rank/library/radio |
| P1 | `src/views/ArtistDetailView.vue` | 约 28KB，多 tab | hero + tab components |
| P1 | `src/views/discover/RecommendTab.vue` | 约 24KB，多区块 | hero、playlist carousel、MV、radio、song sections |
| P2 | 大 CSS 文件 | `discover.css`、`podcast.css`、`main.css` 等 | 页面 CSS、组件 CSS、变量/tokens |

### 6.2 可复用 composables

| 优先级 | composable | 覆盖场景 |
| --- | --- | --- |
| P1 | `useRequestResource` | loading/error/requestId/AbortController/cache/retry |
| P1（已完成） | `useVirtualRows` | 已抽通用虚拟行 composable，并接入歌单详情、资料库、专辑曲目、歌手歌曲、搜索歌曲结果和电台节目 |
| P1 | `useVerticalSnapFeed` | 首页音乐 feed、首页 MV feed |
| P1 | `usePaginatedResource` | 评论、歌单、歌手、专辑、MV、电台分页 |
| P2 | `useSearch` | TopBar、SearchView、SearchDetailView |
| P2 | `useVipStatus` | SidebarNav、SettingsView、Auth |
| P2 | `useMediaPlaybackBridge` | 音频播放器和 MV 播放互斥 |

### 6.3 测试和验证

| 优先级 | 测试 | 内容 |
| --- | --- | --- |
| P0 | 路由 smoke | 已完成：新增 `npm run smoke:routes` 和 `scripts/route-smoke.js`，覆盖 `/home`、`/discover/*`、`/podcast/*`、`/mv`、`/library/*`、`/playlist/:id`、`/album/:id`、`/artist/:id`、`/settings`、`/search`、`/fm` 等路径，报告输出到 `reports/performance/route-smoke.md`，当前 37/37 通过 |
| P0 | 首屏 smoke | 已完成：新增 `npm run smoke:first-screen`，使用 Vite preview + Electron smoke 模式打开 `mappic://app/#/home`，校验路由、Vue 挂载、可见文本、截图非空和渲染进程存活，报告输出到 `reports/performance/first-screen-smoke.md`，截图输出到 `reports/performance/first-screen-home.png`，当前 5/5 通过 |
| P0 | 播放 smoke | 已完成：新增 `npm run smoke:player`，覆盖本地播放、队列上一首/下一首、列表/顺序/单曲/随机模式、音量同步、ended 监听和本地文件错误模型；报告输出到 `reports/performance/player-smoke.md` |
| P1 | 性能 smoke | 部分完成：新增 `npm run smoke:fps`，覆盖首页音乐/视频 feed idle、scroll、recovery FPS 和视频 hydration 小窗口，报告输出到 `reports/performance/home-fps-smoke.md`；待处理：MV 独立页、全屏播放器、桌面歌词打开/关闭 |
| P1 | API 单测 | normalizers、cacheKey、error normalization、lyrics parsing、audio quality |
| P1 | Electron smoke | 已新增 `npm run smoke:electron-proxy` 覆盖 media URL 校验和 Range 头保留；自定义协议、API 代理、真实 media 代理、桌面歌词 IPC 仍待补齐 |
| P2 | 可访问性 | 键盘操作、焦点陷阱、modal 关闭、aria 状态 |

## 7. 分阶段路线图

### 阶段一：P0 修正和基线

1. 已完成：建立包体基线、路由 smoke、播放器 store smoke、首屏 smoke 和首页 FPS smoke；待处理：MV 独立页 FPS。
2. 已完成：补齐搜索和 FM 的路由可达性。
3. 已完成：调整 `KeepAlive` 策略，防止视频/详情页常驻。
4. 部分完成：已抽左侧歌曲摘要、播放模式、传输控制、音量、播放进度、弹幕开关、桌面歌词按钮、播放队列、音质、视觉效果弹层、歌曲动作按钮、桌面歌词桥接逻辑、进度条歌词预览、全屏弹幕评论流和当前歌曲评论弹窗/统计；已新增统一歌词服务；已完成播放 URL 缓存、队列来源/版本治理、音量单一来源持久化、播放模式 store 化、评论数 stale 缓存和播放器错误模型。
5. 已完成服务层/API 大文件拆分：`services/netease.js` 与 `api/modules/netease.js` 均已变为兼容出口，服务层和 API 层按 domain/子模块拆完；下一步推进 normalizers、请求取消、并发池和重试策略。

### 阶段二：高收益性能优化

1. 首页和 MV：限制 DOM、视频释放；封面取色队列和弹幕首批降载已完成。
2. 歌单/资料库/专辑/歌手歌曲：统一虚拟列表。
3. 搜索：抽 `useSearch`，请求取消，详情页分页。
4. 发现页：各 tab 请求分区降级，轮播/定时器在 KeepAlive 下正确暂停。
5. Electron：拆代理和桌面歌词模块，降低 IPC payload。

### 阶段三：代码结构治理

1. 已完成：拆 `services/netease.js` 与 `api/modules/netease.js`。
2. 抽 normalizers 并加单元测试。
3. 拆 `PlayerBar.vue`、`VideoView.vue`、`PodcastView.vue`、`ArtistDetailView.vue`。
4. CSS 模块化，移除重复样式和跨页面耦合。

### 阶段四：增强体验

1. 低性能模式、减少动画模式。
2. IndexedDB 本地资料库。
3. PWA 更新提示和缓存限额。
4. 更完整的社交/朋友页或隐藏入口。
5. 设置导入导出、窗口状态持久化。

## 8. 修改优先级总表

| 页面/功能 | P0 | P1 | P2 | P3 |
| --- | --- | --- | --- | --- |
| 路由 | 已完成：搜索、FM 可达；KeepAlive 白名单 | chunk 预加载 | 404 | - |
| 首页 | 已完成：局部缓存上限、视频 feed hydration 小窗口、封面取色队列、弹幕降载、首页 FPS smoke；待处理：视频释放 | - | 抽 snap feed | 低性能模式 |
| 发现推荐 | - | 已完成：分区接口降级、轮播暂停、歌单轮播容器宽度治理 | 组件拆分 | - |
| 发现歌单 | - | 已完成：首屏减量、分页取消 | 已完成：分类缓存 | - |
| 排行榜 | - | 已完成：缓存上限、榜单详情预取 | 已完成：类型统一 | - |
| 歌手列表 | - | 已完成：请求取消；待处理：长列表治理 | 已完成：tab/filter 缓存 | - |
| 专辑列表 | - | 已完成：首屏减量、滚动加载、地区请求取消 | 已完成：地区缓存；待处理：hover meta 延迟 | - |
| 最新音乐 | 是否启用 | API 化 | 复用 SongListRow | - |
| 电台首页/榜单/乐库 | - | 已完成：分类自动加载治理；待处理：拆子组件、分区加载 | 已完成：rank 缓存 | - |
| 电台详情 | - | 已完成：节目虚拟化、自动加载、路由切换取消 | 播放全部策略 | 评论/订阅完善 |
| MV/视频 | 已完成：离开释放视频 | 已完成：请求取消、无限加载治理、视频地址复用、弹幕降载、列表窗口化；待处理：组件拆分 | 已完成：控制条节流、错误恢复 | 已完成：下一条预取 |
| 私人 FM | 已完成：路由启用 | 批量请求治理、队列补水 | 撤销不想听 | - |
| 歌单详情 | - | 已完成：虚拟列表复用、播放全部分批、路由切换取消 | 本地封面 | - |
| 专辑详情 | - | 已完成：曲目虚拟化、请求取消、评论懒加载、首屏封面优先级 | tooltip 适配 | - |
| 歌手详情 | - | 已完成：歌曲虚拟化、主请求与 tab 分页请求取消、精选预加载降优先级；待处理：tab 拆分 | 已完成：tab 缓存 | - |
| 资料库 | - | 已完成：本地/最近/喜欢歌曲虚拟化；待处理：object URL 策略 | IndexedDB | ID3 元数据 |
| 搜索 | 已完成：路由补齐 | 部分完成：已抽 `useSearch` 复用启动数据/历史/建议，搜索建议和结果请求已接 `AbortController`，搜索详情歌曲结果已接 `useVirtualRows` | 统一空状态、非歌曲网格虚拟化 | - |
| 设置 | - | reduced motion、VIP 复用 | 分组重构 | 导入导出 |
| 桌面歌词 | IPC 频率审计 | 窗口置顶优化、歌词缓存 | 位置持久化 | - |
| 播放器 | 部分完成：左侧歌曲摘要、模式、传输控制、音量、进度、弹幕按钮、桌面歌词按钮、队列、音质、视觉效果、歌曲动作组件化，桌面歌词桥接、进度条歌词预览、全屏弹幕评论流、当前歌曲评论弹窗/统计已抽 composable，统一歌词服务、URL 缓存、队列来源/版本治理、音量统一、播放模式 store 化、评论数 stale 缓存、错误模型、播放 smoke 已完成 | 真实浏览器播放 smoke | 可恢复错误提示 | - |
| 服务层 | 已完成：服务缓存上限、comments/lyrics/search/home/playlist/album/artist/mv/podcast/FM/喜欢/下载/榜单拆分、auth 登录/QR/session/VIP 服务拆分、API domain 原子化与 shared 子模块拆分 | 并发池、取消、重试 | normalizers 单测 | 监控看板 |
| Electron | 已部分完成：主进程薄入口化，拆出协议代理、桌面歌词窗口、smoke 和窗口工具；media 代理已补 GET/HEAD、内网拦截、可选 host 白名单、Range 头 smoke | 真实代理 206/4xx/5xx smoke、API 代理安全、preload 校验 | 窗口状态 | - |
| 构建基线 | 已完成：包体 raw/gzip/brotli 报告、路由 smoke、播放器 smoke、首屏 smoke、首屏截图和首页 FPS smoke | MV 独立页 FPS | 性能预算门禁 | - |
| PWA | - | 版本化缓存、限额 | 更新提示 | - |

## 9. 验收口径

每个优化 PR 都应至少说明：

1. 影响页面和功能。
2. 前后性能指标：bundle、首屏、FPS、内存、接口数中的至少一项。
3. 是否改变用户行为。
4. 是否影响 Electron 和 Web/PWA 双端。
5. 是否有回退策略。

推荐先做一个“只加度量、不改业务”的基线 PR，再逐项推进。这样每个优化都能证明收益，也能避免把重构和性能改善混在一起看不清。
