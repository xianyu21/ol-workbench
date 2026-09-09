# Changelog

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
