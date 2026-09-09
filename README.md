# AxHub 原型工作台（ol-workbench）

Electron 桌面端原型查看器：**零端口、零依赖**（`axhub://` 自定义协议）+ **Vue 3 + Ant Design Vue** 查看器 UI，用于浏览 AxHub 导出的原型目录。

> 2026-08-28 起：仅维护 Electron 桌面端；工作台 UI 已从单文件整体重写为 Vue 3 + Ant Design Vue（Vite 构建）。
> 旧 HTTP 版仅以 `AxHub-HTTP-Server.zip` 保留交付，不再维护。

## 功能特性

- **项目浏览**：左侧项目列表，支持搜索、标签筛选 / 管理、收藏、分组折叠、最近访问分组（置顶 5 条）。
- **多标签查看**：固定、双击固定、中键关闭、右键批量关闭；iframe 池 + LRU 保活（`maxAlive` 可调）与休眠唤醒。
- **iframe 页内联动**：同源拦截页内链接并联动 tab 栏（跨域 / 新窗口 / 锚点不拦截）；Axure 式 JS 跳转（location 赋值）命中已收录页面时标签栏同步切换；点击 tab 后左侧列表自动滚动定位并高亮。
- **搜索高亮**：`Ctrl+K` 全库搜索并高亮命中。
- **数据管理**：重命名、标签改色 / 改名 / 删除、备份导入恢复（合并）、清空数据；收藏 / 标签 / 最近访问 / 标签页布局**落盘持久化**（userData JSON），换端口、清缓存、升级不丢失。
- **快捷键**：`Ctrl+K/D/R/B`、`Alt+W/1-9/←→`；侧栏宽度拖拽与收缩（`Ctrl+B`）。
- **列表极简**：不显示文件大小，列表项仅首字母色块（无缩略图）。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Electron `^30` + electron-builder `^24` |
| UI | Vue `^3.4` + Vite `^5` + Ant Design Vue `^4.2` |
| 请求核心 | Node 内置模块，零第三方依赖；桌面端不监听任何端口 |

## 目录结构

```
desktop/
├─ main.js               # Electron 主进程：axhub:// 自定义协议（serve-core）+ BrowserWindow 打开 axhub://local/_axviewer/
├─ serve-core.js         # ★ 宿主无关请求核心：路由/MIME/Range/缓存/穿越防护/扫描，HTTP 与协议两端复用
├─ preload.js            # IPC 桥：选目录 / 页面清单 / 更新 / 关闭行为 / 用户数据落盘
├─ picker.html           # 首屏选择 AxHub 导出目录
├─ axhub-server.js       # serve-core 的 Node http 适配层：CLI 浏览器模式（node axhub-server.js [目录]）
├─ scan-shared.js        # ★ 页面扫描单源纯逻辑（服务端 require + 浏览器 vite 内联，页面 ID 两端一致）
├─ user-store.js         # 用户核心数据磁盘存储（userData JSON，防抖原子写）
├─ test/                 # node:test 测试（npm test）：请求核心 + HTTP 适配层 + 存储模块 + 扫描单源 + 标签生命周期 + 收藏库合并
├─ viewer/               # ★ Vue3 + Vite + antdv 工程（改 UI 只改这里）
│  ├─ package.json       # vue / ant-design-vue / vite
│  ├─ vite.config.js     # base:'./'，outDir='../viewer-dist'
│  └─ src/
│     ├─ main.js         # 入口，全量注册 antdv
│     ├─ store.js        # 响应式 adapter：标签生命周期决策在 tabs.js，此处赋回 + 持久化
│     ├─ tabs.js         # ★ 标签页生命周期纯函数（零 import，node:test 直测）：开/关/钉/LRU/会话恢复/自导航
│     ├─ user-data.js    # ★ 用户数据持久化 module：get/set/persist/clear，key 清单单源 user-keys.js
│     ├─ library.js      # ★ 收藏库合并纯函数：备份导入合并、扫描清单合并
│     ├─ ui.js / ctx.js  # 弹窗状态 / 全局右键菜单
│     ├─ App.vue         # 布局 + 顶栏 + 快捷键 + antdv 主题（主色 #1296db）
│     └─ components/
│        ├─ Sidebar.vue      # 项目列表：搜索/排序/标签筛选/分组/收藏/右键菜单
│        ├─ TabBar.vue       # 多标签：固定/中键关闭/右键菜单/loading
│        ├─ ViewerPane.vue   # iframe 池 + LRU 休眠唤醒 + 页内链接联动 tab
│        ├─ ContextMenu.vue  # 全局右键菜单
│        └─ modals/          # 重命名/编辑标签/标签管理/备份恢复/设置
├─ viewer-dist/          # vite build 产物（构建生成，不手改）
└─ dist/win-unpacked/    # electron-builder 打包产物
```

## 环境要求

- Node.js ≥ 18（Electron 30 要求）
- npm

## 快速开始

```bash
cd desktop
npm install          # 安装 Electron / electron-builder
cd viewer
npm install          # 安装 Vue / Vite / Ant Design Vue
cd ..

npm start            # 构建 viewer 并启动桌面端
```

## 常用脚本（`desktop/` 下）

| 命令 | 说明 |
|---|---|
| `npm start` | 自动构建 viewer + 启动桌面端（日常开发用这个） |
| `npm test` | 运行测试（Node 内置 test runner，零依赖） |
| `npm run build:viewer` | 只构建 Vue UI（产物到 `viewer-dist/`） |
| `npm run pack` | 构建后出解压版 exe（`dist/win-unpacked/`） |
| `npm run dist` | 构建后出 NSIS 安装包 |

> 打包目标默认：`win` → nsis，`mac` → dmg，`linux` → AppImage（见 `desktop/package.json` 的 `build` 字段）。

## 架构说明

1. **主进程** `main.js` 把 `serve-core.js` 挂到自定义协议 `axhub://`（standard + secure + supportFetchAPI + stream），`BrowserWindow` 打开 `axhub://local/_axviewer/`。不监听任何端口：本机其他进程无法探测导出目录，也不再有端口漂移问题（origin 固定 `axhub://local`）。
2. **请求核心** `serve-core.js` 提供目录扫描与静态服务（路由、MIME、Range/206、immutable 缓存、中文路径、目录穿越防护）；`axhub-server.js`（CLI）与协议层都是它的薄适配。CORS 收紧：仅工作台 UI 路径按需回显 Origin。
3. **查看器 UI** `viewer/` 是独立 Vue 工程，构建产物 `viewer-dist/` 由 Electron 同源加载——改 UI 只改这里。
4. **IPC** `preload.js` 桥接：选择 AxHub 导出目录、页面清单（`tree:get`）、更新检查 / 下载进度、关闭行为、用户数据落盘。
5. **扫描单源** `scan-shared.js`：框架页过滤 / 页面 ID（djb2）/ 分组 / 排序只有一份实现，服务端与浏览器端共用（ID 是用户数据主键，不可漂移）。

## 数据持久化与迁移

- 收藏 / 标签 / 重命名 / 最近访问 / 标签页布局 / 分组折叠状态由主进程落盘到 `userData/wb-user-data.json`（防抖 + 原子写）；`localStorage`（`wb_axhub_*`）退化为同源缓存。
- 旧版数据（纯 localStorage）首次启动自动迁移落盘，无需手工操作；磁盘文件损坏时自动留档 `.corrupt` 并回退缓存数据。
- 浏览器模式（CLI 起 `axhub-server.js` 后浏览器访问）无 Electron 桥接，行为退回纯 localStorage。
## 其他交付物

- `AxHub-HTTP-Server.zip`：旧 HTTP 版交付包（不再维护）。
- `preview.png` / `preview-collapsed.png`：界面预览截图。

## License

MIT
