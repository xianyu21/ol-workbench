# 03: 页面清单改走 IPC（保留浏览器模式回退）

**What to build:** preload 暴露 `getTree: () => ipcRenderer.invoke('tree:get')`。viewer 的 `fetchTree()`（store.js）优先 `window.axhub.getTree()`，不存在时（CLI 浏览器模式）回退 `fetch('/_api/tree')`。两种模式的错误分支保持等价（error 字段 / 连接失败提示）。重建 viewer-dist。

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] 桌面端不再发起 `/_api/tree` 请求（协议层不可达也不报错）
- [x] CLI 浏览器模式 fetch 回退仍工作
- [x] 扫描结果结构与 mergeTree 消费的字段完全一致（id/name/path/size/group/hasData/entry/root/name）

## Comments

## Result

preload 暴露 getTree；fetchTree 优先 window.axhub.getTree()、CLI 浏览器模式回退 fetch(/_api/tree)；错误文案改为「无法读取页面清单」；viewer 重建通过。
