# Changelog

## v1.0.13 · 2026-09-05

> 本版为稳定性验证发布（同时验证在线更新链路），包含 v1.0.10–v1.0.12 全部修复。

### v1.0.13
- 🧪 在线更新链路验证发布

### v1.0.12
- 🐛 彻底修复安装版启动崩溃/白屏报错（"has stopped working" + "Error launching CrashSender.exe"）：
  - 渲染进程沙箱被安全软件 DLL 注入破坏，启动即崩（仅 Program 目录安装版复现）→ 关闭渲染进程沙箱（`no-sandbox`），渲染层仍保持 contextIsolation、无 Node 权限
  - GPU 进程反复崩溃连累主进程退出 → `in-process-gpu` + 禁用硬件加速
  - 崩溃报告进程被拦截导致二次弹框 → 关闭崩溃报告
- 已在真实安装环境实测：渲染进程/GPU 零崩溃，工作台正常加载

### v1.0.11
- 🐛 彻底修复启动崩溃：GPU 进程在本机反复崩溃（0x80000003）连崩 6 次后 Chromium FATAL 退出，即 "has stopped working" 的根因。实测改用 `in-process-gpu`（GPU 代码并入主进程）后稳定，配合禁用硬件加速，DOM/iframe 渲染不受影响

### v1.0.10
- 🐛 修复安装后首次启动可能崩溃的问题：关闭 GPU 硬件加速（显卡驱动与 Chromium GPU 进程兼容问题，反复访问冲突崩溃），工作台为 DOM/iframe 渲染不受影响
- 🔇 关闭崩溃报告（disable-crash-reporter / disable-crashpad），避免被杀毒软件拦截时弹出无意义的 "Error launching CrashSender.exe" 二次报错框

<!--
发版流程：
1. 确认发版时，把「未发布」小节改为正式版本号标题（如 ## v1.0.11 · 2026-09-03），并补充日期
2. git commit + tag vX.Y.Z + push
3. gh release create vX.Y.Z --title "vX.Y.Z" --notes "<该版本累积的更新内容>"
4. cd desktop && npm run dist，产物按 dist/latest.yml 里的文件名重命名后 gh release upload
-->
