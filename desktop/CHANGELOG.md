# Changelog

## 未发布 (Unreleased)

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
