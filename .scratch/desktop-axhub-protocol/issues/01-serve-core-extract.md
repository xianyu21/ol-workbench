# 01: 抽出 serve-core.js 宿主无关请求核心

**What to build:** 把 axhub-server.js 里的静态服务逻辑（路由分发、`/_axviewer` 虚拟路由、`/_api/tree`、MIME、Range/206/416、immutable 缓存头、`Last-Modified`、中文路径解码、目录穿越防护、HEAD、viewer HTML 读取缓存、scanAxHub、safeJoin、VIEWER_DIR 探测）抽成宿主无关的 `serve-core.js`。核心不接触 Node http 的 req/res，而是接收 `{ root, method, urlPath(未解码), headers }`，返回 `{ status, headers, body:Buffer|null, stream:Readable|null }`。axhub-server.js 变成薄 HTTP 适配层（保留 startServer、CLI 入口、控制台输出），并 re-export `scanAxHub`/`safeJoin`/`getViewerHtml` 兼容现有测试。

**Blocked by:** None.

**Status:** ready-for-agent

- [x] 静态服务逻辑只有一份实现，HTTP 适配层不包含任何路由/文件服务判断
- [x] 核心返回值形态稳定（status/headers/body/stream），302/403/404/416 都走描述符
- [x] 现有 axhub-server.test.js 全部通过且无需修改断言（HTTP 外部行为逐字节不变）
- [x] scan-shared.js 单源关系不变（核心 require 同一份扫描模块）

## Comments

## Result

serve-core.js 落地（274 行旧服务→薄适配层）；handleRequest 返回 {status,headers,body,stream,file} 描述符，302/403/404/416 全走描述符；axhub-server.test.js 原断言零修改通过；scan-shared 单源关系不变。
