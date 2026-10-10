# SPI-First 耦合点审计 · AxHub 原型工作台

- 审计日期：2026-09-29
- 审计范围：`desktop/`（Electron 主进程 + Vue3 渲染层），**不含** `node_modules/`、`viewer-dist/`、`dist/`
- 计数口径：业务源码中「具体实现名」出现的**文件数**（排除注释行；`desktop/test/` 不计入）
- 状态：**只读审计，未修改任何业务代码**

---

## 1. 候选耦合点表

| # | 耦合点（语义） | 具体实现名 | 业务文件数 | 优先级 | 未来动因（三动因：替换 / 多实现 / 三方扩展） | 备注 |
|---|---|---|---|---|---|---|
| 1 | 宿主能力（选目录 / 读清单 / 版本更新 / 关闭行为 / 落盘） | `window.axhub`（Electron preload IPC，17 个方法） | **5** 文件 / 24 处 | **P0** | ✅ 多实现**已事实并存**：Electron IPC ⊕ HTTP 同源 `/_api` ⊕ 纯浏览器 File System Access | 业务层靠 `window.axhub?.xxx` 可选链兜底，能力缺失静默降级 → 行为不可测、不可断言 |
| 2 | 用户数据持久化 | `localStorage`（+ Electron 磁盘快照双写） | **4** 文件 / 11 处 | **P1** | ✅ 多实现**已事实并存**（localStorage 缓存 ⊕ 主进程磁盘快照） | 已由 `user-data.js` 基本收口，但 `BackupModal.vue:50` **直调 `localStorage.getItem` 绕过收口**（AP-04）；双写契约无 conformance |
| 3 | 页面清单数据源 | `axhub.getTree()` ⊕ `fetch('/_api/tree')` ⊕ `showDirectoryPicker()` | **1** 文件 / 3 分支 | **P1** | ✅ 同一语义三种实现 | 集中度高（只在 `store.js:116-139`），但三分支 inline 写在业务函数体内 |
| 4 | 用户告知（toast） | `message.*`（ant-design-vue） | **16** 文件 / **61** 处 | **P2** | ❌ 无替换计划 | 逻辑层（`store.js` 6 处）直接依赖 UI 库；但整体抽 SPI 属 AP-06 过度设计，仅登记 |
| 5 | UI 组件库 | `ant-design-vue` | **16** 文件 | **劝阻** | ❌ 无替换计划、无三方扩展 | 明确不动：组件库是全站骨架，抽象成本 >> 收益 |
| 6 | Markdown 解析 | `parseMarkdown`（自研 `api-docs-md.js`） | **1** 文件 | **P2** | ❌ 单实现、无替换计划 | 已有 `test/api-docs-md.test.js`；属**内部模块边界**，不是 SPI |
| 7 | 目录扫描 / 静态服务 | `scan-shared.js`、`serve-core.js` | 2 端共用 | **P2/已解耦** | — | **已宿主无关**（Node 与浏览器/vite 共用同一份），是正面样板 |

---

## 2. 硬编码信号扫描

| 信号类型 | 命中情况 |
|---|---|
| 平台/环境分支散落业务层 | ⚠️ `store.js:122`（`window.axhub?.getTree`）、`store.js:470`（`window.axhub?.selectDir`）、`store.js:478`（`showDirectoryPicker`）——同一函数内三路环境分支 |
| 直接调底层 | ⚠️ `BackupModal.vue:50` 直调 `localStorage.getItem(UserKeys.PREFIX + key)`；`store.js:125` 直调 `fetch('/_api/tree')` |
| 唯一后端抽象 | ✅ 未发现（无空壳 interface） |
| 鉴权/密钥散落 | ✅ 未发现 |

---

## 3. 结论与试点建议

**推荐试点：#1 宿主能力桥（HostBridge）**

理由：
1. 三动因中「多实现并存」**已是事实**而非假设——Electron / HTTP 服务 / 纯浏览器三套宿主同时存在，不是"可能换"；
2. 影响面真实（5 文件 24 处）但**收敛可控**（单一 `window.axhub` 出口，17 个能力可一次性建模）；
3. 改造后立刻可被 conformance 证明：Electron 后端（真实）+ Headless 后端（内存）+ 坏后端（负向用例）跑同一套契约；
4. 顺带消灭 `?.` 可选链兜底带来的"能力缺失静默降级"——改为显式 `capabilities` 声明 + 缺失即报错。

**不推荐试点**：#5（组件库，AP-06 过度设计）、#6（单实现，属内部边界）、#7（已解耦）。

---

## 4. 未做的事

- 未跑性能实测（Phase 3 Step 5 需要时再测）；
- 未修改任何业务代码；
- 未覆盖 `desktop/test/` 内的测试代码耦合（按口径排除）。
