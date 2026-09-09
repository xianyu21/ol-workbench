# 02: main.js 接入 axhub:// 自定义协议

**What to build:** 主进程在 app ready 前 `protocol.registerSchemesAsPrivileged` 注册 `axhub`（standard + secure + supportFetchAPI + stream），ready 后 `protocol.handle('axhub', ...)` 把请求适配到 serve-core（URL 取 `new URL(req.url).pathname`，Range/Origin 从 web Request headers 取；无 Range 用 `Readable.toWeb(fs.createReadStream)` 流式返回，Range 读区间为 Buffer）。`openViewer` 重写：不再 require axhub-server、不再起 HTTP 服务——设置当前导出根目录 → 用 scanAxHub 校验目录可读 → `loadURL('axhub://local/_axviewer/')`。删除：固定端口段循环、httpPing、`/_api/ping` 与 `/_axviewer/` 预检、127.0.0.1/localhost 重试兜底（保留 `setProxy direct`，它影响页面外链资源的代理行为）。新增 IPC `tree:get` 返回 scanAxHub 结果。打包配置：`build.files` 加入 serve-core.js 与 scan-shared.js，extraResources 移除 axhub-server.js/scan-shared.js（桌面端不再用）。

**Blocked by:** 01.

**Status:** ready-for-agent

- [x] 桌面端运行全程不监听任何端口（`net` 断言可选，至少代码路径上无 listen）
- [x] picker → 选目录 → 工作台在 `axhub://local/_axviewer/` 打开，iframe 同源联动正常
- [x] 视频拖动（Range）、中文路径、immutable 缓存在协议层表现与 HTTP 版一致
- [x] 目录不可读/未选目录时协议返回 5xx 且用户看到明确错误，不留白屏
- [x] 关闭/退出路径上不再有 server.close 残留

## Comments

## Result

axhub:// 注册（standard+secure+supportFetchAPI+stream），openViewer 重写为 setRoot→scan 校验→loadURL(axhub://local/_axviewer/)，端口段/httpPing/重试兜底全删，tree:get IPC 落地。真机验证：467 页扫描成功、UI 完整渲染、会话恢复标签 iframe 正常。坑：Readable.toWeb(fs.createReadStream) 经 protocol.handle body 为空（页面白屏根因），改 net.fetch(file://) 流式交付修复。
