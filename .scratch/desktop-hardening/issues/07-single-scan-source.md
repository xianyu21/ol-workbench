# 07: 页面扫描逻辑单源

**What to build:** 把页面扫描纯逻辑（框架页过滤、`start*` 正则、编号前缀分组、djb2 页面 ID 计算、中文排序）抽成一个与宿主无关的共享实现：服务端直接 require，浏览器端由构建流程内联同一份源码。页面 ID 算法保持逐字节一致，确保已有用户数据（按 ID 关联的收藏/标签）不受影响。

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] 两端复用同一份扫描源码，框架页集合/过滤规则只存在一处定义
- [x] 新旧实现对同一目录产出逐字节一致的页面 ID（有验证用例）
- [x] 浏览器端（File System Access 模式）与服务端模式行为一致
- [x] 现有用户数据经合并后无标签/收藏丢失

## Result

新增宿主无关共享模块（CJS 双格式：Node require + vite 内联，commonjsOptions 纳入），服务端与浏览器端扫描胶水各保留目录遍历部分。测试用内联旧版 djb2 算法交叉验证 ID 无漂移；26 项测试全过，viewer 构建通过（确认共享代码进入 bundle）。打包配置已把共享模块加入 extraResources。
