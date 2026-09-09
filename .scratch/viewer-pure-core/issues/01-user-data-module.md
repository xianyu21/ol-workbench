# 01: user-data.js 持久化 module 收口

**What to build:** 新建 `desktop/viewer/src/user-data.js`：interface 四动词 `get(key, def) / set(key, value) / persist() / clear()`；key 清单为 module 内唯一声明（projects/tags/tabs/active/settings/tabSeq/recent/secClosed + 收编的 sbw）；300ms 防抖快照回传 `window.axhub.saveUserData` 藏在 implementation；localStorage write-through 不变。前缀 `wb_axhub_` 与 key 清单抽成 CJS 双格式单源模块（沿 scan-shared 先例，vite commonjsOptions include），preload.js require 同一份。store.js 的 load/saveRaw/persist/scheduleDiskSave 退役改走 module；Sidebar.vue 的 sbw 直写与 BackupModal.vue 的裸清空改走 module（sbw 落盘 bug 在此修复）。主进程 user-store.js 不动。

**Blocked by:** None.

**Status:** ready-for-agent

- [x] `wb_axhub_` 前缀在渲染层 bundle 与 preload 合计只出现一处定义（共享单源模块）
- [x] 持久化 key 清单唯一声明处，sbw 在清单内且拖动后落盘、重启保留
- [x] 组件（Sidebar/BackupModal/TabBar/SectionNode/App.vue）不再直接读写 localStorage
- [x] 浏览器 CLI 模式（无 window.axhub）行为退回纯 localStorage，全部功能不回归
- [x] viewer 构建通过，现有 npm test 不回归

## Comments

## Result

user-keys.js（CJS 单源：前缀+9 key 清单含收编的 sbw）+ user-data.js（get/set/persist/clear，300ms 防抖与 window.axhub 回退在 implementation 内）；store.js 双轨退役、Sidebar sbw 走 module（bug 修复）、BackupModal.clearAll 走 clear()；preload require 同一份 user-keys。真机验证：拖侧栏后磁盘快照出现 wb_axhub_sbw=224，重启后宽度保留（修复前回退默认 300）。
