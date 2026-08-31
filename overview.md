# AxHub 原型工作台 · Electron 桌面端（Vue 3 + Ant Design Vue）

> 2026-08-28 起：仅保留 Electron 桌面端；工作台 UI 已从单文件整体重写为 **Vue 3 + Ant Design Vue（Vite 构建）**。
> HTTP 版仅以 `AxHub-HTTP-Server.zip` 保留交付，不再维护。

## 目录结构

```
desktop/
├─ main.js               # Electron 主进程：内起本地服务 + BrowserWindow 打开 /_axviewer
├─ preload.js            # 选目录 IPC
├─ picker.html           # 首屏选择 AxHub 导出目录
├─ axhub-server.js       # 零依赖本地服务：/_api/tree 扫描；/_axviewer 服务 Vue 构建产物（同源）
├─ viewer/               # ★ Vue3 + Vite + antdv 工程（改 UI 只改这里）
│  ├─ package.json       # vue / ant-design-vue / vite
│  ├─ vite.config.js     # base:'./'，outDir='../viewer-dist'
│  └─ src/
│     ├─ main.js         # 入口，全量注册 antdv
│     ├─ store.js        # 全局状态 + localStorage（wb_axhub_*，与旧版同 key 无缝迁移）
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

## 常用命令（desktop/ 下）

| 命令 | 说明 |
|---|---|
| `npm start` | 自动构建 viewer + 启动桌面端（日常开发用这个） |
| `npm run build:viewer` | 只构建 Vue UI（产物到 viewer-dist/） |
| `npm run pack` | 构建后出解压版 exe（dist/win-unpacked/） |
| `npm run dist` | 构建后出 NSIS 安装包 |

## 已实现功能（旧版全量保真 + 4 项固化交互）

- **不显示文件大小**；列表项仅首字母色块（无缩略图，右键菜单已无缩略图项）
- **iframe 页内链接联动 tab 栏**（同源拦截，跨域/新窗口/锚点不拦截）
- **点击 tab 后左侧列表自动滚动定位**（scrollIntoView 居中 + 高亮）
- 搜索高亮（Ctrl+K）、5 种排序、标签筛选/管理、收藏、分组折叠、最近打开
- 多标签：固定、双击固定、中键关闭、右键批量关、LRU 保活（maxAlive 可调）与休眠唤醒
- 重命名、标签管理（改色/改名/删除）、备份导出/导入（合并/覆盖）、清空数据
- 快捷键：Ctrl+K/D/R/B、Alt+W/1-9/←→；侧栏宽度拖拽与收缩（Ctrl+B）

## 注意事项

- localStorage 结构与旧版一致，老数据（收藏/标签/设置）升级自动继承。
- 旧单文件 `axhub-viewer.html` 保留在 desktop/ 下，仅作 viewer-dist 未构建时的回退，不再维护。
- 沙箱内无图形会话，Electron GUI 无法运行（exe 静默退出属环境限制）；本机正常。
