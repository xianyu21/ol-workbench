# AxHub 原型工作台 v1.4.0 发布说明

> 自动更新增强 P0：更新渠道 / 静默安装健壮性 / 失败重试与回滚。

- 🚀 **更新渠道 stable / beta**：设置页新增渠道选择器并持久化；启动时 `autoUpdater.channel` 按配置生效，切换即重查（portable 版排除）
- 🛡 **静默安装健壮性**：`update:install` 前置 preflight（系统盘剩余 ≥300MB + 安装目录可写），不通过则弹拦截卡且不安装；安装/重启错误从仅写日志升级为渲染层失败事件（`install-failed`）
- ♻️ **失败自愈**：下载失败指数退避重试（30s → 2min → 5min，最多 3 次）+ 设置页手动重试入口
- ↩️ **回滚能力**：每次 UI 就绪持久化 `lastKnownGoodVersion`；安装后首启异常（超时 30s / 渲染进程崩溃）自动回滚，并置 `blockedVersion` 防重装循环；设置页提供手动回滚（二次确认）
- 🧩 **host SPI 新增 6 能力**：`updateStatus`（查询）/ `setUpdateChannel` / `requestUpdateRollback` / `reportFirstLaunchReady` / `retryDownloadNow`（命令）/ `onUpdateEvent`（订阅）；渲染层统一经宿主收发，不直连 `window.axhub`（conformance 守门覆盖）
- 🧪 **测试基线 68 → 85 项**：新增 `errors` / `preflight` / `download` 三套纯逻辑单测 + preload / host-conformance 扩展
- 🐛 **修复 `viewer/package.json` 缺 `type-check` 脚本**：打通 vue-tsc 类型门，避免 CI 类型门静默失效
- 🏗 **设计文档落库**：`.scratch/axhub-update/` 新增 PRD（prd.md）、架构说明（architecture.md）、类图与时序图（Mermaid）
- 📌 说明：beta 发布链路（`latest-beta.yml`）为部署前置，需 CI 单独产出；本地缓存旧安装包降级为 P1 可选增强（P0 改为按需从 Releases 下载旧版回滚，零常驻）；portable 维持「去 Releases 页下载」指引，不纳入本次增强

**验证**：`node --test` 85/0 全绿 · `vue-tsc --noEmit` 0 错 · `build:viewer` 干净（vite 6.4.4）· grep 守门 0 匹配（`import.meta` 限 .ts/.vue/.mjs）

---

## 发版方式（GitHub 全自动流水线）

本仓库已配置 `.github/workflows/release.yml`：**推送 `v*` tag 即自动触发**，CI 完成双平台构建并创建正式 Release。

```bash
# 1) 推送代码（main）
git push origin main

# 2) 打 tag 并推送 —— 触发 CI：Windows(NSIS/Portable) + macOS(dmg/zip) 构建 → 自动创建 Release
git tag v1.4.0
git push origin v1.4.0
```

Release 标题 = tag 名（`v1.4.0`），正文由 CI 自动从 `desktop/CHANGELOG.md` 的 `## v1.4.0` 段落抽取，无需手工填写。

- 进度查看：`gh run list --workflow=release.yml` / `gh run watch`
- 仅构建不发布（验包）：Actions → Release → Run workflow（`workflow_dispatch`）
- 本机手工打包（需手动上传时）：`cd desktop && npm run dist`，产物在 `desktop/dist/`