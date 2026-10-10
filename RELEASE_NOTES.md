# AxHub 原型工作台 v1.3.0 发布说明

> 自 v1.2.3 起的累积版本（整体重构 A 阶段落地 + B 阶段同栈大版本升级）。

- 🚀 **整体重构 A 阶段落地**：主进程模块化（`main.js` 瘦身为 ≤80 行装配入口，业务下沉 `desktop/src/*` 单文件 ≤120 行）；`serve-core` 全 `fs.promises` 异步化 + `setViewerDir` 注入式单源（替代 4 处 fallback 探测）；宿主 SPI 裁剪 browser 后端（仅 electron + headless 两后端），`host/index.js` 三契约 + conformance 守界
- 🧩 **分层 TypeScript**：UI 层（stores / router / composables / components / views）转 `.ts`/`.vue`，`lib/`（纯逻辑）与 `host/`（宿主适配）保持 `.js` 不参与 TS 编译、保 `node --test` 可直测；`vue-tsc --noEmit` 类型守门零错
- 🏗 **npm workspaces 单仓**：合并 `desktop` 与 `viewer`，版本号单源（`bump-version.mjs` 同步 desktop/viewer + 追加 CHANGELOG 占位）；`dist` 与 `dist:safe` 统一走 `dist-safe.mjs`
- 🛡 **工程化守门**：新增 `eslint.config.js` / `.prettierrc` / `.github/workflows/ci.yml`（install → `node --test` → `vue-tsc` → `build:viewer`）
- 🗑 **移除 axhub-server.js**：服务能力并入桌面壳，HTTP 版仅以 `AxHub-HTTP-Server.zip` 归档
- ⬆️ **B 阶段同栈大版本升级**：electron ^30→^33、electron-builder ^24→^25、vue ^3.4→^3.5、vite ^5→^6、@vitejs/plugin-vue ^5.1→^5.2（ant-design-vue 维持 ^4.2.6，4.3 官方未发布）；无 Vue3.5 / Vite6 破坏性回归
- 🐛 **修复 dist-safe NSIS 缓存路径**：对齐 electron-builder 25 布局（`%LOCALAPPDATA%/electron-builder/Cache/nsis-resources-3.4.1`），用 `rmSync` 跨平台清空触发重下；关闭 `dist` 脚本绕过 env 清理的缺口
- 🧪 **测试基线 66 → 68 项**：新增 `serve-core-injection` 注入门用例 + 边界断言；`host-conformance` 收敛为 electron + headless 两后端

**验证**：`node --test` 68/0 全绿 · `vue-tsc` 0 错 · `build:viewer` 干净（vite 6.4.4）· grep 守门 0 匹配（`import.meta` 限 .ts/.vue/.mjs；serve-core 同步 IO 清零）

---

## 手动发版步骤（本机已登录 GitHub 时）

```bash
# 1) 推送代码（含 v1.3.0 提交与 CHANGELOG）
git push origin main

# 2) 创建 GitHub Release（tag 不存在时自动生成）
gh release create v1.3.0 --title "v1.3.0" --notes-file RELEASE_NOTES.md --target main

# 3) 本机正式打包并上传安装包（NSIS / Portable / dmg / zip）
cd desktop && npm run dist
# 产物按 dist/latest.yml 里的文件名重命名后：gh release upload v1.3.0 dist/AxHub-Setup-*.exe dist/AxHub-Portable-*.exe
```

或走网页：GitHub 仓库 → Releases → New release → Tag 填 `v1.3.0`（不存在会自动创建）→ 标题 `v1.3.0` → 描述粘贴本文件正文 → Publish release。
