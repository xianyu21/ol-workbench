# 03: 备份合并与页面清单合并上移纯函数 + 收尾

**What to build:** 把 BackupModal.vue 的 doImport 合并算法（标签并集、计数取大、重命名优先）抽为纯函数（建议 `library.js` 或并入 store.js 导出，签名 `(backup, current) → merged`）；store.js 的 mergeTree 拆为纯函数 `(currentProjects, incomingPages) → {projects, orphanTabs…}`。二者进 node:test（动态 import ESM）。收尾：README/overview viewer 结构行、CHANGELOG 未发布段 + 版本号、工单回写、真机冒烟（含侧栏宽度重启保留验证）。

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] doImport 的合并规则有单元测试覆盖（并集/取大/重命名优先/未知字段容错）
- [x] mergeTree 纯函数化且有测试（新增/保留本地标注/清除已删页面/孤儿 tab 清理）
- [x] 真机冒烟：拖侧栏 → 重启宽度保留；收藏/标签/多标签恢复正常
- [x] 版本号 + CHANGELOG 未发布段更新，未执行发布动作

## Comments

## Result

library.js：mergeProjects（并集/取大/重命名优先/新页追加）、mergeTags、mergeScannedPages（addedAt 注入 now）；BackupModal.doImport 与 store.mergeTree 改调纯函数，tabs.js 补 pruneTabs（keep 回调注入，激活转移语义与旧 mergeTree 一致）。4 项合并单测。真机冒烟通过；版本 1.0.21 + CHANGELOG；未发布。
