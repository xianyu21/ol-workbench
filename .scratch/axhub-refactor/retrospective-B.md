# B 阶段复盘（同栈大版本升级）

> 关联：`.scratch/axhub-refactor/{prd,architecture,implementation}.md`
> 范围：A 阶段架构基线之上的同栈依赖大版本升级（B1–B5）

## 1. 目标与范围

- **目标**：在 A 阶段已落地的架构上，把同栈依赖做一次大版本升级（electron / electron-builder / vue / vite / plugin-vue），**不引入破坏性变更**，产出可发版的 v1.3.0。
- **范围（来自 architecture.md §4.2）**：
  - B1 升级依赖 + 安装
  - B2 打包三坑回归（emptyOutDir / shim env 清理 / NSIS 缓存）
  - B3 Node22 CJS 探测回归（`import.meta` 限 `.js`）
  - B4 UI 破坏性回归（Vue 3.5 / Vite 6）
  - B5 自动更新增强（依 Q6 默认维持现状）

## 2. 实际落地

**版本锚点（实测安装）**

| 包 | 目标 | 实测安装 |
|---|---|---|
| electron | ^33 | 33.4.11 |
| electron-builder | ^25 | 25.1.8 |
| vue | ^3.5 | 3.5.43 |
| vite | ^6 | 6.4.4 |
| @vitejs/plugin-vue | ^5.2 | 5.2.4 |
| ant-design-vue | — | 维持 ^4.2.6（4.3 官方未发布）|

**验证结果（QA 独立验证 + 工程师源码审查，IS_PASS = YES）**

| 门 | 结果 |
|---|---|
| `node --test test/*.test.js` | **68/0 全绿**（host-conformance 仅 electron+headless；serve-core-injection 注入门生效）|
| `vue-tsc --noEmit` | **0 类型错误** |
| `build:viewer` | 干净（vite 6.4.4，3272 模块，8.36s），无 Vue3.5 / Vite6 破坏性 |
| `import.meta` 在 `.js` | **0 匹配**（限 `.ts`/`.vue`/`.mjs`）|
| `serve-core` 同步 IO | **0**（全 `fs.promises`）|
| `emptyOutDir:false` | 在 `viewer/vite.config.ts:18` 仍固化 |

**实质改动（仅 2 处）**

1. `scripts/dist-safe.mjs` NSIS 缓存路径对齐 builder25：旧 `nsis-resources` 错配 v25 布局，改为 `ELECTRON_BUILDER_CACHE || Cache` 下的 `Cache/nsis-resources-3.4.1`，用 `rmSync` 跨平台清空（commit `c410a6d5`）。
2. `package.json` 的 `dist` 脚本原直连 `electron-builder` 会绕过 env 清理，改为 `dist` = `build:viewer && node scripts/dist-safe.mjs`，与 `dist:safe` 统一走固化入口。

**提交 / 发版**

- `532b3bb` refactor: 整体重构 A 阶段落地 + B 阶段依赖升级（v1.3.0）— 28 文件，+2151/−1381
- `f416191` docs: 新增 v1.3.0 修改记录与发布说明（RELEASE_NOTES）
- `0e7084e` docs: CHANGELOG v1.3.0 置顶（符合新版在上约定）
- Release `v1.3.0` 已上线（GitHub，自动生成 `v1.3.0` tag）：https://github.com/xianyu21/ol-workbench/releases/tag/v1.3.0

## 3. 踩坑与时间线

| # | 问题 | 影响 | 处置 |
|---|---|---|---|
| B-K1 | `npm install` 时 esbuild postinstall 用 `spawnSync` 占用被本会话占用的托管 `node.exe` → `EBUSY` | 依赖装不上 | 改用系统 Node + `--ignore-scripts`，手动 `cp esbuild` 平台二进制补位 |
| B-K2 | `ant-design-vue@^4.3.0` 不存在（4.3 未发布） | `npm install` 报 `ETARGET` | 维持 `^4.2.6` |
| B-K3 | NSIS 缓存路径错配 builder25（旧 `nsis-resources` ≠ 实际 `Cache/nsis-resources-3.4.1`） | 打包时 `StdUtils::TestParameter` 缺失可能静默复发 | `dist-safe.mjs` 重写缓存根 + `rmSync` 跨平台清空（c410a6d5）|
| B-K4 | 纯 `dist` 脚本绕过 env 清理 | shim 注入三坑可能复发 | `dist` 改为经 `dist-safe.mjs` |
| B-K5 | 整段 A 阶段重构一直未提交（28 文件脏树） | 状态不清、回滚困难、风险高 | B 阶段收口时一次性提交 `532b3bb` |
| B-K6 | 沙箱网络 / `gh` token 临时失效 | 一度无法 push / 建 Release | 网络恢复后补 `git push` + `gh release create` |
| B-K7 | `bump-version.mjs` 往 CHANGELOG **末尾**追加 → 新版不在顶部 | CHANGELOG 顺序错 | `0e7084e` 手动置顶 |

## 4. 做得好的

- **分层 TS 约束（lib/host/shell 保持 `.js`）** 让 Node22 CJS 探测零故障，B3 一次过——这条铁律在升级中价值凸显。
- **打包三坑早已固化进 `dist-safe.mjs`**，B2 只需核对 + 修一处路径，未出现新坑。
- **A/B 分阶段决策正确**：先稳架构再做同栈升级，升级面小、回归可控，68 项测试全绿。
- **QA 独立验证 + 工程师源码审查双轨**，结论互证，IS_PASS 可信。

## 5. 反思与改进

- **升级前先 `npm view <pkg> versions` 确认目标版本存在**（避免 antdv 4.3 乌龙）。
- **`dist-safe.mjs` 的 NSIS 缓存路径应随 electron-builder 大版本对齐**，或读取 builder 实际的 `nsis-resources` 版本而非硬编码 `3.4.1`，避免下次升级再踩。
- **`--ignore-scripts` 装依赖会漏 Electron 运行时二进制** → 本会话无法实跑 GUI / `dist`；正式出包必须在本机 `npm run dist`（含正常 postinstall 下载 electron）。
- **CHANGELOG 生成脚本建议改为「置顶插入」** 而非末尾追加（消除 B-K7 手动修正）。
- **沙箱网络 / gh 凭据不稳定**，发版前先 `gh auth status` + 试 `git push`，别假设可用。
- **A 阶段重构提交滞后是个风险点**：以后大改完即提交，不要攒到下一阶段。

## 6. 遗留（非阻塞）

- **G7 桌面人工冒烟**仍待本机执行（无图形会话无法在沙箱验证）。
- **Release 安装包资产**（NSIS / Portable / dmg / zip）待本机 `cd desktop && npm run dist` 后 `gh release upload v1.3.0 …`。
- **lint** 本环境未实测（CI 会跑）。
