# Vue 3 标准工程结构 · AxHub 原型工作台

> 2026-09-29 重构：从「单 store.js + 扁平 components」迁移到 Vue 3 官方约定的
> `src/{components,views,router,stores,composables,lib,assets}` 结构，
> 状态管理由自研 `reactive` 单 store 换成 **Pinia**，视图切换接入 **vue-router**。
> 全量 `<script setup>` + Composition API。

## 1. 目录树（Vite 项目根 = `desktop/viewer/`）

```
desktop/viewer/
├── index.html                 # Vite 入口 HTML
├── package.json               # 依赖与脚本（dev / build / watch）
├── vite.config.js             # 构建配置，outDir → ../viewer-dist，别名 @ → ./src
├── jsconfig.json              # 编辑器路径提示（@/* → src/*）
└── src/
    ├── main.js                # createApp + Pinia + Router + antdv 装配
    ├── App.vue                # 应用外壳：顶栏 / 路由视图 / 弹窗组 / 宿主信号
    ├── router/
    │   └── index.js           # hash 路由：/proto、/api（双命名视图）
    ├── views/                 # 页面级组件（路由直达）
    │   ├── ProtoWorkspace.vue # 原型视图：Sidebar + TabBar + ViewerPane
    │   └── ApiWorkspace.vue   # API 视图：ApiSidebar + ApiDocPane
    ├── components/
    │   ├── common/            # 跨视图通用：SvgIcon / ContextMenu / ViewRail
    │   ├── proto/             # 原型视图专属：Sidebar / SectionNode / TabBar / ViewerPane
    │   ├── api/               # API 视图专属：ApiSidebar / ApiDocPane / ApiModuleNode …
    │   └── modals/            # 全部弹窗（业务弹窗集中，不再散在 api/modals）
    ├── composables/           # 组合式函数
    │   ├── useHostSignals.js  # 宿主信号：关闭询问 + 后台更新
    │   └── useShortcuts.js    # 全局快捷键
    ├── stores/                # Pinia
    │   ├── index.js           # barrel：组件只从这里取 hook
    │   ├── workspace.js       # 页面清单 + 收藏库标注 + 目录选择
    │   ├── tabs.js            # 标签页生命周期（决策在 lib/tabs.js）
    │   ├── settings.js        # 界面设置（含 viewMode）
    │   ├── apiDocs.js         # 接口模块库 + 解析派生结构
    │   └── ui.js              # 弹窗显隐 + 右键菜单（运行时状态）
    ├── lib/                   # 零 Vue 依赖的纯逻辑（可被 node:test 直接 import）
    │   ├── tabs.js            # 标签页生命周期纯函数
    │   ├── library.js         # 收藏库合并纯函数
    │   ├── api-docs.js        # 模块库 CRUD 纯函数
    │   ├── api-docs-md.js     # Markdown 解析
    │   ├── theme.js           # 明暗主题
    │   ├── user-data.js       # 持久化唯一出入口
    │   └── constants.js       # PALETTE / DEF_TAGS / NATIVE_ID / VIEW_MODES
    ├── host/                  # 【SPI】工作区宿主（electron / browser / headless 三后端）
    └── assets/styles/
        └── global.css         # 全局样式与 CSS 变量（浅/暗两套）
```

## 2. 分层约定

| 层 | 职责 | 约束 |
|---|---|---|
| `views/` | 路由直达的页面，只做布局拼装 | 不写业务逻辑 |
| `components/` | 按**功能域**分子目录（common / proto / api / modals） | 跨域复用才进 `common/` |
| `stores/` | 响应式状态与业务动作 | 纯逻辑下沉到 `lib/`，store 只做响应式 adapter |
| `lib/` | 纯函数，**零 `import vue` 依赖** | 可被 `node --test` 直接动态 import 测试 |
| `composables/` | 有状态/有副作用的复用逻辑 | 返回 ref 与函数，不持有业务数据 |
| `host/` | 宿主能力 SPI | 业务层禁止直连 `window.axhub` |

## 3. 路由设计（与常规 SPA 不同，是有意为之）

```js
{ path: '/:view(proto|api)', name: 'workspace',
  components: { default: ProtoWorkspace, api: ApiWorkspace } }
```

```vue
<router-view v-show="!isApi" />
<router-view v-show="isApi" name="api" />
```

两个工作区**同时挂载**，由路由参数决定谁可见。原因：原型视图的 `ViewerPane`
持有活的 iframe，若按常规做法让 `<router-view>` 在切换时卸载组件，iframe
会被移出 DOM 并重新加载，已打开页面的交互状态全部丢失。

因此：**路由负责视图状态与深链（`#/api` 可直接进入），常驻挂载负责保活。**
用 hash 模式是因为桌面端跑在自定义协议 `axhub://` 下，hash 不依赖服务端 rewrite。

`settings.viewMode` 仍是持久化事实来源：`main.js` 启动时按它恢复路由，
`App.vue` 监听路由写回。

## 4. 运行

```bash
cd desktop/viewer
npm install          # 依赖：vue / ant-design-vue / pinia / vue-router
npm run dev          # 开发服务器（浏览器模式，走本地服务 /_api/tree）
npm run build        # 产物 → desktop/viewer-dist
```

桌面端（Electron 壳加载构建产物）：

```bash
cd desktop
npm start            # 自动 build:viewer 后启动 Electron
npm run dist         # 打包安装包
```

回归：

```bash
cd desktop && node --test     # 71 项（含宿主 SPI conformance 8 项）
```

## 5. 迁移对照（旧 → 新）

| 旧 | 新 |
|---|---|
| `src/store.js`（单个 reactive 大对象） | `stores/{workspace,tabs,settings,apiDocs,ui}.js` |
| `src/ui.js` + `src/ctx.js` | `stores/ui.js` |
| `src/App.vue` 内联顶栏/快捷键/更新提示 | `App.vue` + `composables/useShortcuts.js` + `composables/useHostSignals.js` |
| `components/*.vue` 扁平 | `components/{common,proto,api,modals}/` |
| `components/api/modals/*` | `components/modals/*`（弹窗集中） |
| `src/{tabs,library,api-docs,api-docs-md,theme,user-data}.js` | `src/lib/*` |
| `src/styles/global.css` | `src/assets/styles/global.css` |
| 相对路径 import | `@/` 别名（vite.config + jsconfig 同步） |
| `settings.viewMode` 手动切换 | vue-router `/proto` `/api` |
