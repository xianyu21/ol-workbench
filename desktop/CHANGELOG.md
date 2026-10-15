# Changelog

## v1.4.0 · 2026-10-12

> 自动更新增强 P0（更新渠道 / 静默安装健壮性 / 失败重试与回滚）。

- 🚀 **更新渠道 stable / beta**：设置页新增渠道选择器并持久化；启动时 `autoUpdater.channel` 按配置生效，切换即重查（portable 排除）
- 🛡 **静默安装健壮性**：`update:install` 前置 preflight（系统盘剩余 ≥300MB + 安装目录可写），不通过弹拦截卡且不安装；安装/重启错误从仅日志升级为渲染层失败事件（`install-failed`）
- ♻️ **失败自愈**：下载失败指数退避重试（30s→2min→5min，最多 3 次）+ 手动重试入口
- ↩️ **回滚能力**：每次 UI 就绪持久化 `lastKnownGoodVersion`；安装后首启异常（超时 30s / 渲染进程崩溃）自动回滚，并置 `blockedVersion` 防重装循环；设置页手动回滚（二次确认）
- 🧩 **host SPI 新增 6 能力**：`updateStatus`（查询）/ `setUpdateChannel` / `requestUpdateRollback` / `reportFirstLaunchReady` / `retryDownloadNow`（命令）/ `onUpdateEvent`（订阅）；渲染层经宿主收发、不直连 `window.axhub`
- 🧪 **测试基线 68 → 85 项**：新增 `errors` / `preflight` / `download` 三套纯逻辑单测 + preload / host-conformance 扩展
- 🐛 **修复 `viewer/package.json` 缺 `type-check` 脚本**（打通 vue-tsc 类型门，避免 CI 类型门失效）
- 📌 说明：beta 发布链路（`latest-beta.yml`）为部署前置，需 CI 单独产出；本地缓存旧安装包降级为 P1 可选增强（P0 改为按需从 Releases 下载旧版回滚，零常驻）；portable 维持「去 Releases 页下载」指引、不纳入增强

验证：`node --test` 85/0 全绿 · `vue-tsc` 0 错 · `build:viewer` 干净 · grep 守门 0 匹配（`import.meta` 限 .ts/.vue/.mjs）

## v1.3.0 · 2026-10-10

> 自 v1.2.3 起的累积版本（整体重构 A 阶段落地 + B 阶段同栈大版本升级），首次登 Release。

- 🚀 **整体重构 A 阶段落地**：主进程模块化（`main.js` 瘦身为 ≤80 行装配入口，业务下沉 `desktop/src/*` 单文件 ≤120 行）；`serve-core` 全 `fs.promises` 异步化 + `setViewerDir` 注入式单源（替代 4 处 fallback 探测）；宿主 SPI 裁剪 browser 后端（仅 electron + headless 两后端），`host/index.js` 三契约 + conformance 守界
- 🧩 **分层 TypeScript**：UI 层（stores / router / composables / components / views）转 `.ts`/`.vue`，`lib/`（纯逻辑）与 `host/`（宿主适配）保持 `.js` 不参与 TS 编译、保 `node --test` 可直测；`vue-tsc --noEmit` 类型守门零错
- 🏗 **npm workspaces 单仓**：合并 `desktop` 与 `viewer`，版本号单源（`bump-version.mjs` 同步 desktop/viewer + 追加 CHANGELOG 占位）；`dist` 与 `dist:safe` 统一走 `dist-safe.mjs`
- 🛡 **工程化守门**：新增 `eslint.config.js` / `.prettierrc` / `.github/workflows/ci.yml`（install → `node --test` → `vue-tsc` → `build:viewer`）
- 🗑 **移除 axhub-server.js**：服务能力并入桌面壳，HTTP 版仅以 `AxHub-HTTP-Server.zip` 归档
- ⬆️ **B 阶段同栈大版本升级**：electron ^30→^33、electron-builder ^24→^25、vue ^3.4→^3.5、vite ^5→^6、@vitejs/plugin-vue ^5.1→^5.2（ant-design-vue 维持 ^4.2.6，4.3 官方未发布）；无 Vue3.5 / Vite6 破坏性回归
- 🐛 **修复 dist-safe NSIS 缓存路径**：对齐 electron-builder 25 布局（`%LOCALAPPDATA%/electron-builder/Cache/nsis-resources-3.4.1`），用 `rmSync` 跨平台清空触发重下；关闭 `dist` 脚本绕过 env 清理的缺口
- 🧪 **测试基线 66 → 68 项**：新增 `serve-core-injection` 注入门用例 + 边界断言；`host-conformance` 收敛为 electron + headless 两后端

验证：`node --test` 68/0 全绿 · `vue-tsc` 0 错 · `build:viewer` 干净（vite 6.4.4）· grep 守门 0 匹配（`import.meta` 限 .ts/.vue/.mjs；serve-core 同步 IO 清零）

## v1.2.3 · 2026-10-10

- 🐛 **修复 CI 打包失败（图标步骤 `Cannot find module 'pngjs'`）**：`package-lock.json` 中 509 个依赖的 `resolved` 地址被写为淘宝镜像 `registry.npmmirror.com`，GitHub Actions（境外）拉取不稳定，`npm ci` 静默缺包后图标生成报错、双平台构建全挂。已将两个 lock 的 `resolved` 全部改回官方源 `registry.npmjs.org`，并新增仓库级 `.npmrc` 固定官方源
- 📌 说明：本次发版内容与 v1.2.3 之前的累积改动同批（壳层模块化 + 工程化 + TS 迁移 + API 文档视图等，见下方 v1.2.2 段）；v1.2.2 因上述 CI 故障未成功产出安装包，改由 v1.2.3 交付

## v1.2.2 · 2026-10-10

> 自 v1.0.40 起的累积版本（壳层模块化 + 工程化 + TypeScript 迁移 + API 文档视图），首次登 Release。

- 🚀 **壳层模块化重构**：`main.js` 从 ~470 行单体拆为「依赖注入 + 装配」的 40 行入口，业务拆到 `desktop/src/`（`app` / `window` / `tray` / `updater` / `protocol` / `logger` / `config` / `context` / `preload-bridge` + `ipc/` 五个处理器）。所有原生依赖以参数注入，模块可独立测试
- 🧩 **IPC 分层**：preload 桥改为 `src/preload-bridge.js` 统一装配，`ipc/{index,workspace,apidocs,close,update,user-data}.js` 按职责分文件，主进程侧不再散落 `ipcMain.on`
- 🛡 **工程化守门**：新增 `scripts/{bump-version,release-check,dist-safe}.mjs`——版本号单源同步（desktop/viewer 一致 + CHANGELOG 占位）、发版前校验三处版本一致、沙箱安全打包；测试从 26 项扩到 **66 项**（新增 ipc / preload / main-smoke / api-docs / host-conformance）
- 🎨 **TypeScript 渐进迁移**：`stores/`、`router/`、`composables/` 核心模块迁移为 `.ts`（保留 `.js` 双份过渡）；`vite.config.ts` 增加 `.ts/.tsx` 解析优先级；补 `tsconfig.json` / `env.d.ts` 类型声明
- 📚 **API 文档视图（新功能）**：工作台新增第二个内容视图，与原型预览并列（左侧 icon 窄栏 `ViewRail` 切换，路由 `#/proto` / `#/api`）
  - 导入 Apifox / Apipost 导出的 Markdown，一个文件即一个业务模块；左侧「业务模块 → 接口」两级树，右侧接口详情 + 代码示例面板
  - Markdown 解析规则集中在 `lib/api-docs-md.js` 顶部常量表（适配不同导出工具差异）；**任何输入都不抛错**，识别不到接口时降级为原文展示
  - 只持久化原始 Markdown、不存解析结果（解析规则升级无需迁移数据）；`apiDocs` 独立持久化通道（避免切换标签时序列化大段 Markdown）
  - 纯文档展示，不发请求、不做接口调试
- 🏗 **前端工程结构规范化**：`src/` 按 Vue 3 官方约定重整为 `views/`（ProtoWorkspace / ApiWorkspace）+ `components/{common,proto,api,modals}/` + `router/` + `stores/` + `composables/` + `lib/`（零 Vue 依赖纯逻辑）+ `host/`（SPI）；import 统一 `@/` 别名（`vite.config` 与 `jsconfig` 同步）
- 🔌 **工作区宿主 SPI**：渲染层对运行环境的唯一语义出入口 `host/index.js`，业务层只认领域动词能力名（`chooseWorkspace` / `readPageManifest` / `archiveSnapshot` …），对「桌面壳 / 本地服务 / 纯浏览器 / 测试」零知识；三后端（electron / browser / headless）+ conformance 契约测试强制守界；渲染层禁止直连 `window.axhub` / `localStorage`
- ⚙️ **构建与打包**：`package.json` 改用 npm workspaces（`viewer` 作为子包）；新增 `type-check` / `lint` / `format` / `dist:safe` 脚本；主进程入口与 `src/` 纳入打包 files
- 🗑 **移除桌面端 axhub-server.js 运行时依赖**：HTTP 版已归档为 `AxHub-HTTP-Server.zip`，桌面端走 `axhub://` 协议零端口（详见 v1.0.27 段）
- 📄 文档：`CONTEXT.md` 补领域语言（视图模式 / API 视图 / 业务模块 / 接口 / 工作区宿主）；新增 `docs/vue3-project-structure.md`、`docs/spi-first-audit.md`、`docs/spi-first-host-bridge.md`；`.scratch/` 补重构 PRD 与架构图

## v1.0.40 · 2026-09-18

- ✨ **侧栏分组头吸顶**：长列表滚动时分组标题常驻顶部（带底色与分隔线），不再丢失上下文
- ✨ **侧栏布局紧凑化**：搜索框与「全部展开/折叠」同排，按钮方块化并加 tooltip
- ✨ **滚动条统一细化**（8px 细圆角、轨道透明），关键容器显式覆盖；并向同源预览 iframe 注入同款细滚动条样式，缩放态禁用 iframe 内层滚动，避免双层滚动条
- ♻️ 侧栏定位（Ctrl+B / 激活联动）跳过「最近访问」分组，定位到真实模块分组里的项
- 🐛 「最近访问」分组不再显示激活高亮，避免与真实分组里的激活项重复
- 🐛 **固定标签受保护**：侧栏点击 / 页内链接跳转绝不原地替换固定页，一律新开未固定标签；未固定当前标签保持浏览器式原地替换；iframe 自导航命中固定页时新开标签承载跳转目标并复位固定页

## v1.0.31 · 2026-09-17

> 含未单独发版的 v1.0.30 迭代（暗色主题 + 标签栏增强）。

- ✨ **后台静默下载更新（默认开启）**：启动后检查到新版本不再弹窗打断，直接后台下载；右下角非模态小卡显示进度，下载完成后提示「立即重启安装 / 稍后」，不处理则退出时自动安装。设置里可关闭（关闭后回到"下载前询问"）
- ✨ **界面主题**：新增 auto / light / dark 三档（theme.js 单源 module），auto 实时跟随系统 prefers-color-scheme；antd 同步切换 darkAlgorithm，全套 CSS 变量随 `html[data-theme]` 切换
- ✨ **标签栏增强**：标签溢出时两端渐显滚动箭头 + 滚轮/触控板横滚 + 「全部标签」下拉直达 + 标签拖拽排序（固定组与未固定组不混排，带插入位置指示线）
- 🐛 修复窗口关闭后更新进度残留窗口标题

## v1.0.29 · 2026-09-09

- 🐛 **修复 macOS 首启动黑屏白字（"AxHub 导出目录未就绪"）**：serve-core 把 root 未就绪检查放在了 `/_axviewer` 虚拟路由之前，导致首次启动/未选目录/移除目录后，空态工作台整个加载不出来，窗口只剩一行 503 文本。现工作台 UI 与 `_api` 不再依赖导出目录，仅导出目录静态服务在未选目录时兜底 503；`/_api/tree` 未选目录时返回空清单（与 IPC 空态结构一致）
- ✅ serve-core 测试补 null-root 空态用例（13+9 项全过）

## v1.0.28 · 2026-09-09

- 🐛 修复 macOS 发布资产名：productName 含中文导致上传截断（v1.0.27 资产变 `AxHub.-1.0.27.dmg`）；build.mac 显式 `artifactName: AxHub-mac-${version}`，dmg/zip 均为纯 ASCII 文件名
- ✨ Release 正文自动取自 CHANGELOG 对应版本段（此前仅 GitHub 自动 commit 对比链接，无实质更新说明）
- 🧹 Release 资产排除 builder-debug.yml（此前 `dist/**` 整目录上传带入调试文件）

## v1.0.27 · 2026-09-09

> 自 v1.0.14 起的累积版本（serve-core 重构 + 数据落盘 + UI/交互迭代 + 全平台打包），首次登 Release。

- 🚀 **架构重构（零端口）**：静态服务核心抽为 serve-core.js 挂自定义协议 `axhub://`（origin 固定 `axhub://local`，localStorage 与端口彻底解耦）；桌面端全程不监听任何端口，本机其他进程无法再探测目录清单；页面清单改走 preload IPC；axhub-server.js 仅保留 CLI/HTTP 适配层（与桌面端同源）
- 🔒 **数据与安全**：收藏/标签/最近访问/标签页布局/分组折叠落盘 userData 磁盘文件（换端口/清缓存/升级不丢），旧 localStorage 自动迁移；CORS 收紧；恢复默认 webSecurity；主进程日志超 1MB 自动轮转
- ♻️ **可测性**：tabs 生命周期 / user-data 持久化 / 合并算法抽为纯函数 module（零 import），key 清单单源；node:test 测试基线 49 项
- ✨ **UI/交互迭代**：最近访问分组（5 条置顶常驻）；侧栏拖拽调宽（100px~35%）+ 固定宽度恢复 + logo 切换（Ctrl+B）；「移除目录」与无目录引导弹窗；会话恢复懒加载；iframe JS 跳转标签联动
- ⚡ **更新链路**：托盘后台运行 + 关闭行为三选项；更新下载页面内进度条；便携版升级指引；每 24h 静默检查；版本号单源
- 🛠 修复 preload 沙箱导致 `window.axhub` 整桥缺失；electron-builder 打包配置合规化；CI 双平台出包（Windows NSIS/Portable + macOS dmg/zip，macos-14 runner）
- 📦 打包与自动化：图标程序化生成（win ico / mac icns 同源）；push tag → 全自动正式 Release

分版明细（v1.0.14–v1.0.21，随 v1.0.27 一并发布）：

### v1.0.21
- ♻️ 标签页生命周期抽为纯函数 module（viewer/src/tabs.js，零 import）：开/关/钉/LRU 休眠/会话恢复/自导航重指向全部可 node:test 直测；「激活标签永不休眠」invariant 改由构造保证，ViewerPane 安全网 watcher 删除
- ✨ 用户数据持久化收口为 user-data.js module（get/set/persist/clear 四动词）：key 清单单源 user-keys.js（preload 共用），`wb_axhub_` 前缀不再散落四处；🐛 修复侧栏宽度不落盘、每次启动被重置的 bug
- ♻️ 备份导入合并算法与页面清单合并（mergeTree）上移为 library.js 纯函数并补单测
- 🧪 测试 49 项（+15）：tabs 生命周期 11 项、library 合并 4 项
- 📝 新增 CONTEXT.md 领域术语表（架构评审 grilling 产物）

### v1.0.20
- ✨ 桌面端去 axhub-server.js 运行时依赖：静态服务核心抽为 serve-core.js，挂到自定义协议 `axhub://`（standard+secure+supportFetchAPI+stream），BrowserWindow 直接加载 `axhub://local/_axviewer/`
- 🔒 桌面端全程不监听任何端口：本机其他进程无法再探测导出目录页面清单（旧 `/_api/tree` 在 127.0.0.1 对所有本地进程开放）；页面清单改走 preload IPC（tree:get）
- 🔥 删除固定端口段循环 / ping 预检 / loadURL 四次重试与 localhost 兜底等端口相关补丁：origin 固定 `axhub://local`，localStorage 与端口彻底解耦
- ♻️ axhub-server.js 保留为 CLI 浏览器模式（node axhub-server.js [目录]）与 zip 交付的 HTTP 适配层，路由/文件服务逻辑与桌面端同源于 serve-core.js
- ✅ 测试 34 项：新增 serve-core 描述符级直测（穿越编码变体/Range/416/HEAD/302/503），原 HTTP 外部行为用例全部保留通过
- 📦 打包 files 纳入 serve-core.js/scan-shared.js，extraResources 移除 axhub-server.js（桌面端不再需要）

### v1.0.19
- ✨ 用户核心数据（收藏/标签/最近访问/标签页布局/分组折叠）落盘到 userData 磁盘文件：换端口、清缓存、升级不再丢数据；旧 localStorage 数据自动迁移
- ✨ 备份弹窗「清空全部本地数据」同步清磁盘；提示文案更新
- 🔒 CORS 收紧：静态资源与 API 不再对任意来源放行（防网页探测本地目录），仅工作台 UI 路径按需回显 Origin
- 🔒 渲染层恢复默认 webSecurity（此前因 file:// 遗留关闭；同源服务下无需关闭）
- ♻️ 页面扫描逻辑单源（scan-shared.js）：服务端与浏览器端共用，页面 ID 哈希两端逐字节一致
- ⚡ 会话恢复懒加载：重启只立即加载激活标签，其余点击时唤醒，冷启动更快
- ✨ iframe 内 JS 跳转（Axure 式 location 赋值）命中已收录页面时标签栏同步切换，且不触发 iframe 二次加载
- 📝 主进程日志超 1MB 自动轮转（保留一份 .old），长期后台运行不再无限增长
- ✨ 更新体验：下载进度改为页面内进度条；便携版检查到新版本给出 Releases 下载指引；每 24 小时静默检查一次
- 🧹 版本号单源（app.getVersion）；清理误生成文件、修复失效 gitignore 规则；README 与现状同步
- 📦 打包产物改英文命名（AxHub-Setup-*/Portable-*）；新增 tag → 构建安装包 + Release 草稿工作流（正式发布仍需人工确认）
- ✅ 测试基线（node:test，零依赖，`npm test`）：本地服务请求层 13 项 + 存储模块 9 项 + 扫描单源 4 项

### v1.0.18
- 🐛 修复「最近访问」分组打开页面后不即时出现（改用响应式数据源）
- 🔧 本地服务改用固定端口段（41730 起）：修复每次重启端口变化导致 localStorage（最近访问/标签/收藏）全部丢失的问题

### v1.0.17
- ✨ 「最近访问」分组正式落位左侧栏顶部
- 🐛 修复侧栏收起后无展开按钮：按钮移出侧栏元素固定定位，收起后仍显示在屏幕左缘
- 🔥 移除列表视图图标

### v1.0.16
- 🔥 移除侧栏排序下拉（固定收藏置顶 + 名称排序）
- ✨ 新增「最近访问」分组：置顶显示最新 5 条，常驻展开，不参与全部展开/全部折叠
- 🔥 移除具体链接下方的「最近」小标记
- 🐛 修复侧栏收起后找不到展开按钮：收起时展开按钮固定显示在屏幕左缘

### v1.0.15
- ✨ 点击关闭按钮改为**页面内 antd 弹窗**询问"后台运行 / 直接退出"，样式与工作台统一，可勾选记住选择
- ✨ 设置弹窗新增「点击关闭按钮时」选项（每次询问 / 后台运行 / 直接退出），随时可改
- ✨ 后台运行时最小化到系统托盘：托盘菜单可打开工作台 / 退出，双击托盘图标恢复窗口

### v1.0.14
- ✨ 托盘后台运行 + 关闭行为询问（后台运行 / 直接退出，可记住选择）初版

## v1.0.13 · 2026-09-05

> 本版为稳定性验证发布（同时验证在线更新链路），包含 v1.0.10–v1.0.12 全部修复。

### v1.0.13
- 🧪 在线更新链路验证发布

### v1.0.12
- 🐛 彻底修复安装版启动崩溃/白屏报错（"has stopped working" + "Error launching CrashSender.exe"）：
  - 渲染进程沙箱被安全软件 DLL 注入破坏，启动即崩（仅 Program 目录安装版复现）→ 关闭渲染进程沙箱（`no-sandbox`），渲染层仍保持 contextIsolation、无 Node 权限
  - GPU 进程反复崩溃连累主进程退出 → `in-process-gpu` + 禁用硬件加速
  - 崩溃报告进程被拦截导致二次弹框 → 关闭崩溃报告
- 已在真实安装环境实测：渲染进程/GPU 零崩溃，工作台正常加载

### v1.0.11
- 🐛 彻底修复启动崩溃：GPU 进程在本机反复崩溃（0x80000003）连崩 6 次后 Chromium FATAL 退出，即 "has stopped working" 的根因。实测改用 `in-process-gpu`（GPU 代码并入主进程）后稳定，配合禁用硬件加速，DOM/iframe 渲染不受影响

### v1.0.10
- 🐛 修复安装后首次启动可能崩溃的问题：关闭 GPU 硬件加速（显卡驱动与 Chromium GPU 进程兼容问题，反复访问冲突崩溃），工作台为 DOM/iframe 渲染不受影响
- 🔇 关闭崩溃报告（disable-crash-reporter / disable-crashpad），避免被杀毒软件拦截时弹出无意义的 "Error launching CrashSender.exe" 二次报错框

<!--
发版流程：
1. 确认发版时，把「未发布」小节改为正式版本号标题（如 ## v1.0.11 · 2026-09-03），并补充日期
2. git commit + tag vX.Y.Z + push
3. gh release create vX.Y.Z --title "vX.Y.Z" --notes "<该版本累积的更新内容>"
4. cd desktop && npm run dist，产物按 dist/latest.yml 里的文件名重命名后 gh release upload
-->

## v1.4.1 · 2026-10-15

- **修复安装版启动后提示「找不到工作台 UI」**：`main.js` 此前无条件把 viewerDir 注入为 `__dirname/viewer-dist`，打包后 `__dirname` 落在 `app.asar` 内，而 viewer-dist 由 `extraResources` 放在 asar 外的 `resources/viewer-dist`，主进程始终指向不存在的路径。现按 `isPackaged` 分流，打包后指向 `process.resourcesPath/viewer-dist` 同级目录，与 extraResources 落点一致。
- 新增 2 个回归守门测试：packaged 场景断言 `getViewerDir()` 解析到 `resourcesPath/viewer-dist`；源码级禁止 main.js 再无条件拼接 `__dirname/viewer-dist`。全量测试 70/70 通过。
- 打包卫生：`build.files` 排除 `src/**/__tests__/**`，生产 asar 不再携带 update 模块的测试文件。
