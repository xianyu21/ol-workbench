# AxHub 原型工作台（ol-workbench）

Electron 桌面端原型查看器：本地**零依赖** HTTP 服务 + **Vue 3 + Ant Design Vue** 查看器 UI，用于浏览 AxHub 导出的原型目录。

> 2026-08-28 起：仅维护 Electron 桌面端；工作台 UI 已从单文件整体重写为 Vue 3 + Ant Design Vue（Vite 构建）。
> 旧 HTTP 版仅以 `AxHub-HTTP-Server.zip` 保留交付，不再维护。

## 功能特性

- **项目浏览**：左侧项目列表，支持搜索、5 种排序、标签筛选 / 管理、收藏、分组折叠、最近打开。
- **多标签查看**：固定、双击固定、中键关闭、右键批量关闭；iframe 池 + LRU 保活（`maxAlive` 可调）与休眠唤醒。
- **iframe 页内联动**：同源拦截页内链接并联动 tab 栏（跨域 / 新窗口 / 锚点不拦截）；点击 tab 后左侧列表自动滚动定位并高亮。
- **搜索高亮**：`Ctrl+K` 全库搜索并高亮命中。
- **数据管理**：重命名、标签改色 / 改名 / 删除、备份导出 / 导入（合并 / 覆盖）、清空数据。
- **快捷键**：`Ctrl+K/D/R/B`、`Alt+W/1-9/←→`；侧栏宽度拖拽与收缩（`Ctrl+B`）。
- **列表极简**：不显示文件大小，列表项仅首字母色块（无缩略图）。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Electron `^30` + electron-builder `^24` |
| UI | Vue `^3.4` + Vite `^5` + Ant Design Vue `^4.2` |
| 本地服务 | Node 内置 `http`，零第三方依赖 |

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
| `npm run build:viewer` | 只构建 Vue UI（产物到 `viewer-dist/`） |
| `npm run pack` | 构建后出解压版 exe（`dist/win-unpacked/`） |
| `npm run dist` | 构建后出 NSIS 安装包 |

> 打包目标默认：`win` → nsis，`mac` → dmg，`linux` → AppImage（见 `desktop/package.json` 的 `build` 字段）。

## 架构说明

1. **主进程** `main.js` 启动本地服务并打开 `BrowserWindow`，加载 `/_axviewer`。
2. **本地服务** `axhub-server.js` 提供 `/_api/tree` 目录扫描与 `/_axviewer` 静态服务（与页面同源，避免跨域）。
3. **查看器 UI** `viewer/` 是独立 Vue 工程，构建产物 `viewer-dist/` 由 Electron 同源加载——改 UI 只改这里。
4. **IPC** `preload.js` 提供选择 AxHub 导出目录的能力。

## 数据迁移

- `localStorage` 结构与旧版一致（`wb_axhub_*`），老数据（收藏 / 标签 / 设置）升级后自动继承。
- 旧单文件 `axhub-viewer.html` 仅作 `viewer-dist` 未构建时的回退，不再维护。

## 其他交付物

- `AxHub-HTTP-Server.zip`：旧 HTTP 版交付包（不再维护）。
- `preview.png` / `preview-collapsed.png`：界面预览截图。

## License

MIT
