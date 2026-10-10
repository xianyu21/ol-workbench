# CONTEXT.md · 领域术语表

AxHub 原型工作台的领域语言。架构深挖（deepening）时用这里的名字称呼 seam 与 module；决策记录见 `docs/adr/`（暂无）与 `.scratch/<feature>/spec.md` 的决策记录段。

## 核心概念

- **导出目录（Export Root）**：AxHub/Axure 标准扁平导出的根目录，`index.html` 为框架页、顶级 `.html` 为业务页面、`resources/data/images/files` 共享。请求核心（serve-core）的根目录即它。
- **页面清单（Page List）**：一次扫描得到的业务页面集合，每项含稳定 ID（djb2，算法单源 scan-shared.js）。ID 是用户数据的主键，两端逐字节一致，不可漂移。
- **标签页（Tab）**：工作台里一个可切换的页面视图槽位。字段 `{id,pid,pinned,title,native,sleep,loading,src,rc,lastActive}`；生命周期规则（打开/关闭/钉住/休眠/唤醒/会话恢复/自导航重指向）集中在 `viewer/src/tabs.js` 纯函数 module——"激活标签永不休眠"是该 module 的构造 invariant。
- **休眠（Sleep）/唤醒（Wake）**：LRU 保活策略下销毁/重建 iframe 的机制。`src` 快照保证唤醒与自导航不触发二次加载。
- **收藏库（Library）**：用户对页面的全部标注数据的总称——收藏、标签、重命名、最近访问、打开计数。按页面 ID 关联。
- **用户数据（User Data）**：收藏库 + 标签页布局 + 界面设置 + 分组折叠 + 侧栏宽度 + 接口模块库（apiDocs），渲染层经 `viewer/src/user-data.js`（四动词 interface）持久化；桌面端落盘 userData JSON（主进程 user-store.js），localStorage 仅为同源缓存。key 清单单源 `user-keys.js`，新增持久化字段必须登记，否则重启丢失。apiDocs 走独立的 `persistApi()`（不并入 `persist()`，避免每次切标签都序列化大段 Markdown）。
- **原生导航（Native Navigation）**：AxHub 自带 index.html 框架导航（页面树 + 顶栏），工作台以"NATIVE_ID 标签页"承载它。
- **视图模式（View Mode）**：`settings.viewMode` = `proto`（原型页面预览）| `api`（API 视图）。由最左侧图标窄栏（ViewRail）切换，随 settings 一同持久化。原型视图的 TabBar/ViewerPane 用 `v-show` 保活，切回不重载 iframe。
- **API 视图（API View）**：查阅接口文档的第二个内容视图。左侧为「业务模块 → 接口」两级树，右侧为接口详情 + 代码示例面板。只做文档展示，不发请求、不做调试。
- **业务模块（Module）**：一个导入的 Markdown 文件即一个业务模块。字段 `{id,name,fileName,size,importedAt,rev,md}`；只持久化原始 Markdown，不存解析结果（解析规则升级无需迁移数据）。CRUD 纯函数在 `viewer/src/api-docs.js`。
- **接口（Endpoint）**：解析产物、不持久化。字段 `{id,moduleId,name,method,path,summary,desc,headers,pathParams,query,body,responses,reqExample,resExample,extras,warnings,raw}`。解析规则（Apifox/Apipost 导出差异）集中在 `viewer/src/api-docs-md.js` 顶部常量表；任何输入都不抛错，识别不到接口时降级为原文展示。
- **框架页（Frame File）**：导出目录里不属于业务页面的 HTML（index/start/通用组件等），扫描时过滤，规则单源 scan-shared.js。

## 前端工程结构（2026-09-29 起，v1.1.7）
- Vite 根 = `desktop/viewer/`；`src/` 下按官方约定分 `views/`（ProtoWorkspace / ApiWorkspace，路由直达）、`components/{common,proto,api,modals}/`（按功能域分）、`router/`、`stores/`（Pinia）、`composables/`、`lib/`（零 Vue 依赖纯逻辑）、`host/`（SPI）、`assets/styles/`。import 统一用 `@/` 别名（`vite.config.js` 与 `jsconfig.json` 同步）。
- 状态分五个 Pinia store：`workspace`（页面清单+收藏库）、`tabs`（标签页生命周期）、`settings`、`apiDocs`、`ui`（弹窗/右键菜单，运行时）。纯逻辑（标签页决策、收藏库合并、模块 CRUD、Markdown 解析）留在 `lib/`，保持可被 `node --test` 直接 import。
- 视图切换走 vue-router（hash 模式，`#/proto` 与 `#/api`），但**两个 workspace 常驻挂载用 v-show**，不用单 `<router-view>` 卸载——否则 ViewerPane 的 iframe 被移出 DOM 会重载。`settings.viewMode` 仍是持久化事实来源，启动时由 main.js 恢复路由、App.vue 写回。

## 边界词汇

- **请求核心（serve-core.js）**：宿主无关静态服务 module；两个 adapter——`axhub://` 协议层（桌面端，零端口）与 Node http 层（CLI 浏览器模式）。
- **工作区宿主（WorkspaceHost）**：渲染层对运行环境的唯一语义出入口 `viewer/src/host/index.js`（2026-09-29 起的 SPI）。业务层只认能力名（`chooseWorkspace` / `readPageManifest` / `archiveSnapshot` / `onExitRequest` …），对「桌面壳 / 本地服务 / 纯浏览器 / 测试」零知识。三个后端：`host/electron.js`（壳桥，能力全）、`host/browser.js`（本地服务 + 浏览器目录句柄）、`host/headless.js`（内存，测试与降级）。契约由 `test/host-conformance.test.js` 用同一套用例跑遍所有后端 + 2 条负向用例强制。新能力必须先登记 `ALL_CAPABILITIES`。
- **桥接（window.axhub）**：preload 暴露给渲染层的唯一主进程通道（选目录/页面清单/更新/关闭行为/用户数据落盘）。**业务层不得直接引用**——仅 `host/electron.js` 适配器内允许；宿主能力一律经 WorkspaceHost。
