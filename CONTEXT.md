# CONTEXT.md · 领域术语表

AxHub 原型工作台的领域语言。架构深挖（deepening）时用这里的名字称呼 seam 与 module；决策记录见 `docs/adr/`（暂无）与 `.scratch/<feature>/spec.md` 的决策记录段。

## 核心概念

- **导出目录（Export Root）**：AxHub/Axure 标准扁平导出的根目录，`index.html` 为框架页、顶级 `.html` 为业务页面、`resources/data/images/files` 共享。请求核心（serve-core）的根目录即它。
- **页面清单（Page List）**：一次扫描得到的业务页面集合，每项含稳定 ID（djb2，算法单源 scan-shared.js）。ID 是用户数据的主键，两端逐字节一致，不可漂移。
- **标签页（Tab）**：工作台里一个可切换的页面视图槽位。字段 `{id,pid,pinned,title,native,sleep,loading,src,rc,lastActive}`；生命周期规则（打开/关闭/钉住/休眠/唤醒/会话恢复/自导航重指向）集中在 `viewer/src/tabs.js` 纯函数 module——"激活标签永不休眠"是该 module 的构造 invariant。
- **休眠（Sleep）/唤醒（Wake）**：LRU 保活策略下销毁/重建 iframe 的机制。`src` 快照保证唤醒与自导航不触发二次加载。
- **收藏库（Library）**：用户对页面的全部标注数据的总称——收藏、标签、重命名、最近访问、打开计数。按页面 ID 关联。
- **用户数据（User Data）**：收藏库 + 标签页布局 + 界面设置 + 分组折叠 + 侧栏宽度，渲染层经 `viewer/src/user-data.js`（四动词 interface）持久化；桌面端落盘 userData JSON（主进程 user-store.js），localStorage 仅为同源缓存。
- **原生导航（Native Navigation）**：AxHub 自带 index.html 框架导航（页面树 + 顶栏），工作台以"NATIVE_ID 标签页"承载它。
- **框架页（Frame File）**：导出目录里不属于业务页面的 HTML（index/start/通用组件等），扫描时过滤，规则单源 scan-shared.js。

## 边界词汇

- **请求核心（serve-core.js）**：宿主无关静态服务 module；两个 adapter——`axhub://` 协议层（桌面端，零端口）与 Node http 层（CLI 浏览器模式）。
- **桥接（window.axhub）**：preload 暴露给渲染层的唯一主进程通道（选目录/页面清单/更新/关闭行为/用户数据落盘）。
