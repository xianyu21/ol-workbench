# 02: tabs.js 标签页生命周期纯函数 module

**What to build:** 新建 `desktop/viewer/src/tabs.js`：零 import（不碰 vue/reactive），不可变风格——函数吃普通对象状态 `({tabs, active, tabSeq}, args)`、返回新状态，不改入参。动词：`open`（复用未固定当前标签/强制新开/已有即激活）、`close`（含激活转移）、`setActive`（构造上保证激活项不休眠：目标在睡则唤醒）、`togglePin`（固定置顶排序）、`closeOthers/closeAllUnpinned`、`reload`（rc++/清 src 快照/置 loading）、`lruSweep`（maxAlive 内休眠最久未用的未固定非激活项，激活项永不入眠——invariant 由构造保证）、`restoreSession`（除激活外全部懒休眠）、`retargetSelfNav`（iframe 自导航命中已收录页面时重指向 pid/title/native）、`matchPageByUrl`（URL→页面匹配，bindFrameLinks 与自导航共用）。store.js 变响应式 adapter（调用后整体赋回 reactive store 并触发 user-data 持久化）；ViewerPane 删除 applyLru/wake/启动懒休眠/安全网 watcher 的自有实现改调 store；TabBar 的 reloadById 改调 store。lastActive 时间戳由 store 层注入（纯函数收 now 参数）。

**Blocked by:** 01.

**Status:** ready-for-agent

- [x] tabs.js 零 import，node:test 可直接动态 import 测试
- [x] 安全网 watcher（ViewerPane「激活标签不应休眠」）删除——invariant 由 setActive/lruSweep/restoreSession 构造保证
- [x] LRU/会话恢复/开关钉标签行为与重构前逐项一致（现有交互手工回归）
- [x] tabs.js 有单元测试：LRU 不休眠激活项/固定项、restore 只留激活、open 复用未固定标签、close 激活转移
- [x] ViewerPane/TabBar 不再直接改 tab 字段（渲染与 DOM 事件绑定除外）

## Comments

## Result

tabs.js 16 个导出（含 enc/srcOf/matchPageByUrl URL 词汇单源）；store.js 变响应式 adapter（applyTabs 赋回+persist）；ViewerPane 删除 applyLru/wake/懒休眠内联实现与安全网 watcher，TabBar reloadById 改 store.reloadTab；lastActive 由 setActive/open 注入 now。11 项单测钉住 invariant（LRU 不休眠激活/固定项、restore 只留激活、close 激活转移、不可变入参）。
