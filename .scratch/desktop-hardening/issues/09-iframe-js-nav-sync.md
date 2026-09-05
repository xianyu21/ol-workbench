# 09: iframe 内 JS 导航联动标签栏

**What to build:** 原型页面内通过 JS（location.href 赋值等方式）跳转到另一个已收录页面时，工作台标签栏同步切换/打开对应标签，复用现有页内链接联动的 openProject 路径。同源前提下对 iframe 文档注入轻量监听实现；跨域、新窗口、页内锚点行为维持现状不拦截。

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Axure 式 JS 跳转命中已收录页面时，标签栏同步（新开或切换，遵循现有复用策略）
- [x] 跳转未命中已收录页面时行为不变
- [x] 跨域/新窗口/锚点场景不被误拦截
- [x] 监听不引入可感知的页面卡顿

## Result

ViewerPane 在 iframe load 后比对 contentWindow.location 与 src 快照，命中已收录页面则重指向标签（pid/title/bump/persist）且不改 src → 不重载；未命中/跨域/同页不动。新增每标签 src 快照（frameSrc），休眠/刷新/浏览器式替换时清除重算。viewer 构建通过；Axure 真机导出点验待做。
