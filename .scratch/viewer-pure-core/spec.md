# Spec: viewer 纯核——持久化收口与标签页生命周期深挖

Status: ready-for-agent

## Problem Statement

grilling 共识（2026-09-06，架构评审候选 1+2，用户全部同意）：工作台最易出竞态的逻辑（LRU 休眠、会话恢复、自导航重定向）锁在 ViewerPane/TabBar 组件里，store 把裸可变状态当 interface，靠"安全网 watcher"兜底 invariant；用户数据持久化一个概念摊在 4 个文件、3 份副本、两个防抖，`wb_axhub_` 前缀硬编码 4 处。seam 泄漏已产出真 bug：侧栏宽度 `sbw` 直写 localStorage 从不落盘、每次启动被 preload 清快照抹掉。

## Solution

两条深挖共用一条 seam：

1. **持久化 module（user-data.js）**：interface 收敛为 `get(key, def) / set(key, value) / persist() / clear()` 四动词；key 清单（9 个，含收编的 `sbw`）是唯一声明处；防抖与 `window.axhub` 桥回退藏进 implementation；localStorage 保留为 write-through 缓存（浏览器 CLI 模式同一份代码）。前缀/清单与 preload 单源（CJS 双格式，沿 scan-shared 先例）。
2. **标签页生命周期（tabs.js）**：零 import（不碰 vue）的纯函数 module——open/close/setActive/togglePin/reload/lruSweep/restoreSession/selfNav 匹配；不可变风格返回新状态，"激活标签永不休眠"由构造保证，安全网 watcher 删除。store.js 退为响应式 adapter。
3. **同一片纯核收尾**：备份合并算法与 mergeTree 上移为纯函数并入测试网。

## User Stories

1. 作为用户，我调整侧栏宽度后重启，宽度保持不变（sbw 落盘 bug 修复）。
2. 作为用户，我的收藏/标签/标签页/折叠状态/侧栏宽度的落盘时机与时机合并由一处决定，任何 key 新增不会漏落盘。
3. 作为维护者，LRU/恢复/开关钉标签是纯函数单测，不需要挂载 Vue 组件。
4. 作为维护者，持久化 key 只有一个声明处；组件不直接碰 localStorage。
5. 作为维护者，备份导入合并与页面清单合并是纯函数，边界情况可枚举测试。

## 决策记录（grilling 定案）

- Q1 范围：修 sbw bug；closeAction 双真相归一**推迟**到将来拆 main.js 批次（不在本批）。
- Q2 tabs.js 零依赖：不 import vue，store.js 做响应式 adapter。
- Q3 风格：不可变返回新状态，不做原地修改+意图。
- Q4 interface：四动词 + 声明式 key 清单；`saveRaw`/裸 localStorage 访问全部退役。
- Q5 落地：01 持久化 → 02 tabs.js → 03 合并纯函数+测试收尾。

## Out of Scope

- closeAction 双真相、main.js 拆解（候选 3）。
- 任何 UI 行为/交互变化（sbw 持久化除外，它是 bug 修复）。
- LRU/恢复语义变化（行为保持重构）。
