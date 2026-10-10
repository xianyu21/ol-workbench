# AxHub 原型工作台 · 整体重构 PRD（简单 PRD）

> 文档角色：重构方案阶段产物，供架构师出技术方案、用户拍板。
> 配套决策记录约定：沿用仓库既有 `.scratch/<feature>/spec.md` + `issues/*.md` 先例（本 PRD 落 `.scratch/axhub-refactor/`）。

---

## 0. 项目信息

| 项 | 内容 |
|---|---|
| Language | 中文 |
| Programming Language | Electron + Node（壳/服务，CJS）、Vue 3 + Vite + Ant Design Vue（UI，ESM） |
| Project Name | `axhub_refactor` |
| 原始需求复述 | 对 `desktop/` 主工程（UI + 壳层 + 构建/打包 + 测试体系）做整体重构；目标覆盖「架构调整 / 技术栈演进 / 性能效率 / 可维护性 / 目录结构」五点；范围不含根目录已归档的 `AxHub-HTTP-Server.zip`。 |

### 0.1 现状澄清（重要，影响方案基线）
任务简报里的「现状」描述的是**旧架构**（单 `store.js`、由 `axhub-server.js` 直出 `/_api/tree`、无宿主 SPI）。**实际代码库已是 2026-09-29 重构后的成熟形态**，本 PRD 的痛点与需求均基于真实代码：

- 壳层：`main.js`（~473 行单体）+ `serve-core.js`（宿主无关请求核心）+ `scan-shared.js`（扫描单源）+ `user-store.js`/`user-keys.js`（持久化单源）+ `preload.js`（IPC 桥）。
- UI：`desktop/viewer/` 已是 Vue 3 + Vite + Ant Design Vue + **Pinia** + **vue-router**；`lib/`（零 Vue 纯逻辑）+ `host/`（**SPI，electron/browser/headless 三后端**）。
- 测试：`node --test` 共 71 项（`desktop/test/` + `viewer/src/lib` + `host-conformance`），CJS 风格、动态 `await import`、禁用 `import.meta`。
- 既有 `.scratch/` 已有 `desktop-hardening`、`desktop-axhub-protocol`、`viewer-pure-core` 三套 spec+issues，说明「spec 先行、按 issue 落地」已是团队习惯。

> 因此本轮重构不是「从零搭架构」，而是**在已成型架构上做深化**：补齐壳层模块化与测试、异步化 IO、固化打包/版本流程、统一工程组织，并把「技术栈是否演进」作为待确认决策点抛出。

### 0.2 约束与铁律（重构不得破坏）
1. 只维护 Electron 桌面端；HTTP 版仅以 `AxHub-HTTP-Server.zip` 保留，不动。
2. 每次修改都 bump `desktop/package.json` 的 `version`，安装包文件名随之带新版本号。
3. 前端已是 Vue 工程：改 UI 改 `desktop/viewer/src/`，再 `npm run build:viewer`；不再有可改的单文件 `axhub-viewer.html`。
4. 宿主 SPI：渲染层禁止直连 `window.axhub` / `localStorage`（仅 `host/` 适配器与 `user-data.js` 例外）；宿主出入口唯一 `viewer/src/host/index.js`；electron/browser/headless 三后端缺一不可。
5. 测试：`node --test` 用例必须 CJS 风格（动态 `await import`），**禁用 `import.meta`**。
6. 打包三坑（实测）：`vite.config.js` 设 `emptyOutDir:false`；`npm run dist` 须清空 shim 注入（`env NODE_OPTIONS= CODEBUDDY_SESSION_ID= CLAUDE_SESSION_ID= npm run dist`）；`StdUtils::TestParameter` 缺失时删 `nsis-resources` 缓存重下。

> 声明：本 PRD 所有需求均不违反上列铁律；凡涉及铁律的条款以「固化/脚本化既有规则」而非「修改规则」方式落地。

---

## 1. 产品目标

| 维度 | 本次重构目标（可衡量） |
|---|---|
| **架构调整** | 主进程不再为单体文件：按职责拆为可装配模块（IPC / 更新 / 托盘 / 日志 / 生命周期），单文件职责 ≤ 1 关注点；宿主 SPI 守界持续通过 conformance 测试。 |
| **技术栈演进** | **本轮不强行定版**（见 §5 Q1）。如用户拍板升级，则统一升级 Electron / builder / Vue / Vite / antdv / Node 并全量回归；如拍板维持，则仅在既有栈内做结构治理。 |
| **性能 / 效率** | 主进程 IO 全异步化（消除 `fs.readSync`/`statSync` 阻塞事件循环）；构建产物 chunk 命中率保持；`npm run dist` 一键可复现（消除手敲环境变量）。 |
| **可维护性** | 壳层与桥（main.js / preload.js / electron 后端）具备自动化测试；引入 lint + format + 最小 CI 守门；关键决策落 ADR/spec。 |
| **目录结构** | 主进程拆目录（`desktop/src/` 或 `desktop/ipc/`、`updater/`、`tray/` 等）；构建编排去 `cd` 化；打包/版本流程脚本化、文档化。 |

正交性检查：上述 5 项目标互不重叠——架构（文件组织）、技术栈（依赖版本）、性能（运行时开销）、可维护性（质量门）、目录结构（仓库布局）。

---

## 2. 用户故事

**终端用户（用工作台的人）视角**
- 作为原型设计师，我希望工作台「选择目录 → 浏览 → 多标签预览」始终流畅，即使打开几十个页面也不卡顿/爆内存，以便高效走查大目录。
- 作为长期用户，我希望升级后我的收藏/标签/最近访问/标签页布局**零丢失**且无需重设，以便无缝衔接。
- 作为用户，我希望更新能稳定下载安装（含便携版亦可被告知），以便及时用上新功能。

**开发者（维护/扩展视角）**
- 作为维护者，我希望主进程按职责分文件且可单测，以便改一处不牵动全局、降低回归风险。
- 作为贡献者，我希望有 lint/format/CI 与 ADR 记录，以便快速理解约定、避免破坏 SPI 守界与铁律。
- 作为发布负责人，我希望版本号与打包流程脚本化、可复现，以便每次发版不漏 bump、不打错环境变量。

---

## 3. 需求池（P0 / P1 / P2）

> 每条格式：**现状痛点 → 重构后预期**。优先级：P0 必须有 / P1 应该有 / P2 可选。

### P0（必须有）

| # | 需求 | 现状痛点（实证） | 重构后预期 |
|---|---|---|---|
| P0-1 | 主进程模块化拆分 | `main.js` 单文件 ~473 行，混装协议注册、日志、托盘、自动更新（~100 行）、IPC handler、窗口生命周期、目录/文档选择、关闭行为；无分层、改动风险高 | 拆为 `app.js`（装配）+ `ipc/`（各 handler 模块）+ `updater.js` + `tray.js` + `logger.js`；`main.js` 退化为入口装配，单文件 ≤ 80 行 |
| P0-2 | 壳层/桥自动化测试 | `node --test` 已覆盖 serve-core/scan/user-store/viewer-lib/host，但 `main.js`、`preload.js`、electron 主机后端（真实 IPC 部分）**零测试** | 把 IPC 注册抽为可注入 `ipcMain` 的纯函数；新增 electron 后端 conformance + preload 单元（mock `ipcRenderer`）+ `main` 烟雾测试（协议/菜单装配无异常） |
| P0-3 | serve-core IO 异步化 | `serve-core.js` 的 `withContent` 用 `fs.readSync`/`fs.openSync` 同步读 Range；`fileResponse`/`scanAxHub` 用 `statSync`；`getViewerHtml` 同步读 + 逐次 mtime 比对 → 阻塞主进程事件循环 | Range/静态读取改 `fs.promises` + 流式；大媒体拖动不再卡 UI；性能可量化（压测单请求 P99 下降） |
| P0-4 | 查看器目录单一真源 | `serve-core.js` 启动时对 `VIEWER_DIR` 做 4 处 fallback 探测（`__dirname`/`resourcesPath`/`../`/`../../`/`cwd`），结构微调即取错、难测 | 由 `main.js` 启动时经 `serve-core.setViewerDir(path)` **显式传入**，`serve-core` 不再散落探测；移除兜底分支 |

### P1（应该有）

| # | 需求 | 现状痛点 | 重构后预期 |
|---|---|---|---|
| P1-1 | 版本号单源 + 脚本化 bump | 铁律 #2 要求每次手改 `desktop/package.json` 的 `version`；与 `app.getVersion()`、GitHub Release tag 三处需人工一致，易漏 bump 致用户无法识别更新 | 使用 `npm version` 钩子 + 脚本同步并生成 changelog；发版清单校验三处版本一致；不改铁律，仅把「手改」变「脚本辅助」 |
| P1-2 | 打包三坑固化 | 铁律 #6 三个坑（emptyOutDir:false / dist 清 shim 注入 / nsis-resources 缓存）仅靠 README 文字记忆，易踩 | 固化为 `npm run dist:safe`（脚本预清环境变量 + 缓存检测）；写进 `.scratch/axhub-refactor` 的 issue 文档，CD 可复用 |
| P1-3 | 双 package 工程组织统一 | `desktop/package.json` 与 `desktop/viewer/package.json` 两套依赖、两处 `npm install`；`build:viewer` 须 `cd viewer`，易版本漂移 | 引入 npm workspaces（或统一编排脚本），依赖去重、版本单一来源；构建命令不再 `cd` 化（铁律 #3 前端仍是 Vue 工程不变） |
| P1-4 | 工具链与最小 CI | 全仓无 eslint / prettier / 类型 / CI；SPI 守界、CJS 测试风格等约定靠人工记忆 | 接入 eslint+prettier（仅校验、不改功能）；CI 跑 `node --test` + 守界/接口纯净性断言，PR 合并前守门 |
| P1-5 | `axhub-server.js` 边界澄清/裁剪 | HTTP 版依铁律 #1「仅归档」；但 `axhub-server.js`（CLI/浏览器模式）仍保留并与协议层同为 serve-core 的薄适配，存在重复与边界模糊 | 决策后执行：若保留浏览器/CLI 模式，则抽「薄适配基类」消除与协议层重复；若仅保留 zip，则彻底移除并删 `axhub-server.test.js` 相关 |
| P1-6 | iframe 池内存/切换开销治理 | `ViewerPane` 多标签多 iframe 常驻保活（`maxAlive` 可调），标签多时内存膨胀；LRU 唤醒靠 `src` 快照重建有成本 | 探索更优保活（虚拟渲染 / 更精准 LRU 权重 / 必要时 Electron webview），**严守**「激活标签永不休眠」「同源页内联动」两不变量；属性能优化，须 A/B 对比内存 |

### P2（可选）

| # | 需求 | 现状痛点 | 重构后预期 |
|---|---|---|---|
| P2-1 | 主题跟随系统实时切换 | `theme.js` 管 `auto/light/dark`，`settings.theme` 持久化，但未监听系统主题变更实时切换 | 监听 `prefers-color-scheme`，系统切换时即时换肤；token 收口到一处 |
| P2-2 | 自动更新增强 | win 仅 NSIS 支持自动更新、portable 不支持、应用未签名 | 决策：是否补齐签名 / 支持 portable 更新 / 走内嵌更新器；影响发布流程 |
| P2-3 | `user-keys.js` 双源一致性 | 该文件被 `preload` require 且被 `viewer/lib/user-data.js` 经 vite commonjs 内联，构建后实为「两份字节」，源改未 rebuild 会漂移 | 加构建期校验：内联副本 hash 须与源一致；守界 rule 写入 conformance |
| P2-4 | 主进程日志异步化 | `main.js` 的 `log()` 在热路径用 `fs.appendFileSync` 同步写，积压时阻塞 | 改异步/批量写 + 后台 flush；保持 1MB 轮转语义 |
| P2-5 | 决策记录（ADR）制度化 | 既有 `.scratch/` 三套 spec 但无统一 ADR 索引；`CONTEXT.md` 备注「暂无」 | 新增 `docs/adr/` 索引，技术栈等重大决策落 ADR，被 `CONTEXT.md` 引用 |

---

## 4. UI / 交互设计稿（文字描述）

> 本轮重构以「壳层/工程/测试」为主，**UI 视觉与交互不强制变动**。以下描述现状体验与重构后体验的差异边界，供判断是否需同步改 UI。

| 场景 | 现状体验 | 重构后预期（不破坏既有交互） |
|---|---|---|
| 选择目录 → 进工作台 | 首启/无目录：先白屏加载 `/_axviewer`，再由页面弹「添加目录」引导；选完主进程 reload 进工作台 | 流程不变；因 serve-core 异步化 + 目录单源，重载/打开更稳，无"取错 viewer 目录导致白屏"风险 |
| 多标签预览 | iframe 池 + LRU 保活，激活标签不休眠；多标签内存随打开数线性增长 | 交互不变；若 P1-6 落地，内存更平稳、切换更顺，但用户侧**无感知差异**（仅资源占用下降） |
| 升级后数据 | 收藏/标签/最近访问/标签布局经 `user-store.js` 防抖原子写落盘，升级不丢 | 不变；版本号单源（P1-1）后升级识别更可靠 |
| 更新下载 | 右下角非模态进度 + 就绪提示；portable 仅给下载指引 | 不变；若 P2-2 落地，portable 也可获更新能力 |
| 开发期改 UI | 改 `viewer/src/*` → `npm run build:viewer` → 重启；构建须 `cd viewer` | 不变（铁律 #3）；若 P1-3 落地，构建编排统一、无需手动 `cd` |

**重构不触碰的交互铁律**：原型/API 双工作区 `v-show` 常驻保活（切路由不卸载 iframe）、`Ctrl+K/D/R/B` 等快捷键、侧栏拖拽收缩、右键菜单、页内链接联动 tab。

---

## 5. 待确认问题（Open Questions）

### Q1（核心）技术栈是否演进？—— 现状版本
当前栈：`Electron ^30` + `electron-builder ^24` + `Vue ^3.4` + `Vite ^5` + `Ant Design Vue ^4.2` + `pinia ^2.3` + `vue-router ^4.6` + 最低 `Node ≥ 18`。

| 选项 | 描述 | 利 | 弊 | 初步倾向 |
|---|---|---|---|---|
| **A. 维持不动** | 仅在既有栈内做架构/测试/性能/目录治理，不升版本 | 风险最低、回归面最小；完全守住铁律 #3/#4 | 两年未演进；Electron 30 已停止维护，潜在安全/性能落后 | 兜底方案 |
| **B. 同栈大版本升级** | Electron→33/34、builder→25/26、Vue→3.5、Vite→6/7、antdv→4.3+、Node→20/22 | 性能/安全收益、依赖可维护性提升；生态主流 | 有 API/打包踩坑（尤其 emptyOutDir、沙箱 shim、NSIS 缓存，见铁律 #6）；需全量回归 + 重新验证三坑 | **初步主推** |
| **C. 换 React 或其他** | 推翻 Vue 改 React/Svelte 等 | （无显著必要收益） | 与铁律 #3「前端已是 Vue 工程」直接冲突；UI/组件/测试全推翻，成本极高 | **不建议本轮** |

> 结论预留：PRD 阶段不替用户定版。建议架构师就 A/B 出两份方案（含升级踩坑清单与回归计划），由用户拍板；C 不纳入本轮候选。

### Q2 `axhub-server.js`（CLI/浏览器模式）是否保留？
影响 P1-5 裁剪范围。若产品上不再需要浏览器模式，可随 `AxHub-HTTP-Server.zip` 一并归档移除，减少重复适配；若仍需，则抽共享薄适配基类。

### Q3 UI 层是否引入 TS？
与「`lib/` 纯逻辑须可被 `node --test` 直测、铁律 #5 CJS 风格」存在权衡；若引入需保证测试入口仍是 CJS/动态 import。建议保持 JS，或在 `viewer` 子工程内局部试点（不影响壳层 CJS）。

### Q4 构建编排：workspaces 单仓 vs 保持双 package？
P1-3 的取舍：workspaces 可去重依赖、统一脚本，但会让 `desktop/` 与 `viewer/` 耦合更紧；保持双 package 则隔离性好、与铁律 #3 边界一致。

### Q5 版本号/发布流程自动化程度？
本地脚本辅助（P1-1）vs CI 自动 bump + tag + 发 GitHub Release。需与 Q2-2 更新策略一并考虑。

### Q6 自动更新策略
是否补齐代码签名、支持 portable 自动更新（P2-2）？涉及证书成本与发布流程改造，需用户决策。

---

## 6. 验收口径（草案）
- P0-1：主进程职责分文件，任意单文件 ≤ 120 行；`node --test` 对壳层新增 ≥ 1 套可用测试且无异常。
- P0-3：`serve-core` 全路径无同步 `readSync/openSync/statSync`（grep 守门）；压测单请求 P99 下降可量化。
- P0-4：`serve-core` 移除 `VIEWER_DIR` 多路径 fallback，仅接受 `setViewerDir` 注入。
- P1-1：发版走脚本，三处版本号（package / getVersion / tag）自动一致校验。
- P1-4：CI 绿灯门包含 `node --test` + 既有 `host-conformance` 的接口纯净性/守界断言。
- 全程：铁律 #4（SPI 三后端 + 守界）、#5（CJS 测试）、#6（打包三坑）在重构后仍 100% 通过。
