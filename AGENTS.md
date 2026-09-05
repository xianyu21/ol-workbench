# AxHub 原型工作台

Electron 桌面端（主进程 main.js + 零依赖本地服务 axhub-server.js）+ Vue 3 工作台 UI（desktop/viewer/，Vite 构建产物由本地服务在 /_axviewer 同源服务）。项目结构与常用命令见 README.md 与 overview.md。

## Agent skills

### Issue tracker

Issues live as local Markdown under `.scratch/<feature-slug>/` (spec.md + issues/NN-<slug>.md). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, label string equals role name (needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
