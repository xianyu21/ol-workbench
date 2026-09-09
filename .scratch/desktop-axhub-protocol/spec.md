# Spec: 桌面端去 axhub-server.js 运行时依赖（axhub:// 自定义协议）

Status: ready-for-agent

## Problem Statement

桌面端目前靠主进程内嵌的 axhub-server.js 在 127.0.0.1 上起 HTTP 服务来加载工作台与原型页面。这带来三类问题：

1. **本地端口暴露**：`127.0.0.1:41730` 对本机所有进程开放，`/_api/tree` 返回的本地目录清单任何本地进程都能读到（CORS 只防浏览器，不防本机进程）。
2. **端口管理包袱**：为保 localStorage origin 稳定维护了固定端口段循环；VPN/安全软件拦 localhost 又催生了代理直连、ping 预检、loadURL 四次重试、localhost 兜底等一连串补丁。
3. **架构耦合**：Electron 桌面端与 CLI 浏览器模式共用一份 HTTP 实现，桌面端被拖着一个它并不需要的网络监听。

## Solution

桌面端改用 Electron 自定义协议 `axhub://`（`protocol.registerSchemesAsPrivileged` + `protocol.handle`）：standard + secure + supportFetchAPI + stream，viewer 与原型页同挂在 `axhub://local` 一个 origin 下，iframe 同源联动、相对路径资源、Range 媒体播放全部保持。页面清单改走 preload IPC（`window.axhub.getTree()`），浏览器/CLI 模式回退 `fetch('/_api/tree')`。

静态服务核心（路由、MIME、Range/206、缓存头、中文解码、目录穿越防护、扫描）抽成宿主无关的 serve-core.js：HTTP 适配层（axhub-server.js，保留 CLI 模式与 zip 交付）与 axhub:// 协议适配层（main.js）都是薄壳；node:test 测试打在核心上，两端行为同源。

## User Stories

1. 作为安全敏感的用户，我想让桌面端不再监听任何本地端口，这样本机其他进程无法探测我的 AxHub 导出目录内容。
2. 作为桌面端用户，我想让工作台 origin 固定为 `axhub://local`，这样不再存在端口漂移丢 localStorage 的任何可能。
3. 作为桌面端用户，我想让 iframe 同源联动、相对路径资源、中文路径、视频/音频拖动（Range）与之前完全一致，这次迁移对我不可见。
4. 作为维护者，我想让静态服务逻辑只有一份核心实现、两个薄适配层（HTTP / 自定义协议），测试打在核心上，这样两端行为永远不会分叉。
5. 作为 CLI 用户，我想让 `node axhub-server.js` 浏览器模式继续可用，这样无 Electron 的场景（zip 交付）不受影响。

## Out of Scope

- 不删除 axhub-server.js（CLI 模式与 AxHub-HTTP-Server.zip 交付仍依赖它）。
- 不改 viewer UI 的任何交互行为。
- 不动自动更新、用户数据落盘等既有机制。
