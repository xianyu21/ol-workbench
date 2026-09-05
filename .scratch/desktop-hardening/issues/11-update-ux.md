# 11: 更新体验改进

**What to build:** 三项更新体验改进：① 下载更新时在工作台页面内显示进度提示（经现有 preload 桥接传递进度，样式与既有弹窗一致），取代仅窗口标题展示；② portable 版手动检查更新且有新版本时，给出"请到 Releases 页面重新下载"的明确指引（portable 不支持自动更新）；③ 增加每 24 小时的静默定时更新检查，失败仍完全静默。

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] 下载更新时页面内可见进度提示，完成后进入既有安装流程
- [x] portable 版检查到新版本时展示重新下载指引而非下载询问
- [x] 应用持续运行超过 24 小时后会再次静默检查更新
- [x] 无网络/更新源不可达时无任何打扰

## Result

① download-progress 经 IPC 推送页面内 antd 进度条（null 复位）；② 便携版（PORTABLE_EXECUTABLE_DIR 识别）检查到新版本改为 Releases 指引弹窗 + 打开页面；③ 启动 5s 检查后每 24h 静默复查。真机更新链路点验待做（现有 v1.0.13 线上版本链路此前已验证）。
