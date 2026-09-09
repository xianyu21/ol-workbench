'use strict';
/*
 * AxHub 原型工作台 · 请求核心（宿主无关） v1.0.1
 * --------------------------------------------------------------
 * 静态服务的全部路由与文件逻辑都在这里，不接触 Node http 的 req/res，
 * 也不依赖 Electron：两个薄适配层复用同一份实现——
 *   - axhub-server.js  ：Node http 适配层（CLI 浏览器模式 / zip 交付）
 *   - main.js          ：Electron axhub:// 自定义协议适配层（桌面端，不监听端口）
 *
 * 入口 handleRequest({ root, method, urlPath, headers })：
 *   urlPath 为「未解码、不含 query」的路径（http 的 u.pathname / URL 的 pathname）；
 *   headers 为普通对象（req.headers / 从 web Request 逐项取出）。
 * 返回响应描述符 { status, headers, body, stream }：
 *   body 为 string|Buffer|null；stream 为 Readable（大文件/非 Range 时优先流式）；
 *   HEAD 请求 body 与 stream 均为 null 但 Content-Length 保留。
 */
const fs = require('fs');
const path = require('path');
const AxHubScan = require('./scan-shared.js');

// 当前导出根目录（HTTP 与协议适配层共享；setRoot 在每次打开/切换目录时调用）
let ROOT = null;

// 工作台 UI：Vue3 + antdv 构建产物目录（desktop/viewer/ → vite build → viewer-dist/）
// 开发期 __dirname = desktop/，打包后 serve-core 位于 app.asar 内、viewer-dist 在 resources/ 下，
// 两种形态按顺序探测。
let VIEWER_DIR = path.join(__dirname, 'viewer-dist');
if (!fs.existsSync(VIEWER_DIR)) {
  const alts = [
    path.join(process.resourcesPath || '', 'viewer-dist'),
    path.join(__dirname, '..', 'viewer-dist'),
    path.join(__dirname, '..', '..', 'viewer-dist'),
    path.join(process.cwd(), 'viewer-dist')
  ];
  for (const a of alts) { if (a && fs.existsSync(a)) { VIEWER_DIR = a; break; } }
}

function setRoot (root) { ROOT = root ? path.resolve(root) : null; }
function getRoot () { return ROOT; }

// ---------- MIME ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.csv': 'text/csv; charset=utf-8'
};
function mimeOf (p) { return MIME[path.extname(p).toLowerCase()] || 'application/octet-stream'; }

// ---------- 安全路径 ----------
function safeJoin (root, reqPath) {
  // reqPath 已 decode
  const t = path.normalize(path.join(root, reqPath));
  if (t !== root && !t.startsWith(root + path.sep)) return null; // 防目录穿越
  return t;
}

// ---------- 扫描 AxHub 标准扁平导出（纯逻辑见 scan-shared.js 单源） ----------
function scanAxHub (root) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch (e) { return { error: '无法读取目录: ' + e.message, pages: [], root, name: path.basename(root) }; }
  const pages = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const f = ent.name;
    if (AxHubScan.isFrameFile(f)) continue;
    let st;
    try { st = fs.statSync(path.join(root, f)); } catch (e) { continue; }
    const name = AxHubScan.baseNameOf(f);
    pages.push({
      id: AxHubScan.computePageId(f),
      name, path: f, size: st.size, group: AxHubScan.groupOf(name), mtime: st.mtimeMs
    });
  }
  AxHubScan.sortPages(pages);
  const hasData = fs.existsSync(path.join(root, 'data', 'document.js'));
  const hasIndex = fs.existsSync(path.join(root, 'index.html'));
  return {
    pages, root,
    name: path.basename(root),
    entry: hasIndex ? 'index.html' : null,
    hasData,
    note: 'AxHub 标准扁平导出：index.html 为框架，顶级 .html 为各业务页面，resources/data/images/files 共享。'
  };
}

// ---------- 静态文件响应描述符（支持 Range；不写 socket，由适配层落地） ----------
function fileResponse (method, full, status, allowOrigin, root) {
  let st;
  try { st = fs.statSync(full); } catch (e) {
    return { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: '404 Not Found', stream: null };
  }
  if (st.isDirectory()) {
    // 尝试目录下的 index.html
    const idx = path.join(full, 'index.html');
    if (fs.existsSync(idx)) return fileResponse(method, idx, status, allowOrigin, root);
    return { status: 403, headers: {}, body: 'Forbidden', stream: null };
  }
  const total = st.size;
  const type = mimeOf(full);
  // Axure 导出的资源目录内容基本不变，可长缓存 immutable；HTML/JSON 保持 1 小时以便重新导出后生效
  const seg0 = path.relative(root, full).split(path.sep)[0];
  const ext = path.extname(full).toLowerCase();
  const immutableExt = new Set(['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.mp4', '.webm', '.mp3', '.wav']);
  const immutableDir = new Set(['resources', 'images', 'files', 'data', 'css', 'js', 'styles', 'scripts', 'fonts']);
  const isImmutable = immutableExt.has(ext) || immutableDir.has(seg0);
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': isImmutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    'Last-Modified': st.mtime.toUTCString()
  };
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;
  return { status: status || 200, headers, total, file: full, body: null, stream: null };
}

// ---------- 读取工作台 UI（按 mtime 缓存，文件变更自动热更新，无需重启） ----------
let VIEWER_HTML = null, VIEWER_MTIME = -1, VIEWER_HTML_FILE = null;
function viewerIndexFile () {
  const idx = path.join(VIEWER_DIR, 'index.html');
  try { fs.accessSync(idx); return idx; } catch (e) { return null; }
}
function getViewerHtml () {
  const f = viewerIndexFile();
  try {
    const st = fs.statSync(f);
    if (!VIEWER_HTML || VIEWER_HTML_FILE !== f || st.mtimeMs !== VIEWER_MTIME) {
      VIEWER_HTML = fs.readFileSync(f, 'utf8');
      VIEWER_MTIME = st.mtimeMs;
      VIEWER_HTML_FILE = f;
    }
  } catch (e) {
    if (!VIEWER_HTML) VIEWER_HTML = '<!doctype html><meta charset=utf-8><h1>找不到工作台 UI</h1><p>请在 desktop/viewer 下执行 <code>npm run build</code> 生成 viewer-dist（运行 <code>npm start</code> 会自动构建）。</p>';
  }
  return VIEWER_HTML;
}

// ---------- 请求处理核心（CLI 与 Electron 协议层复用） ----------
// 返回 { status, headers, body, stream }；stream 需要适配层 pipe / 转 web stream。
function handleRequest (opts) {
  const root = opts.root;
  const method = (opts.method || 'GET').toUpperCase();
  const headers = opts.headers || {};
  const plain = (status, text, type) => ({ status, headers: type ? { 'Content-Type': type } : {}, body: text, stream: null });

  if (!root) return plain(503, 'AxHub 导出目录未就绪', 'text/plain; charset=utf-8');
  // urlPath 允许畸形的百分号编码：与旧版一致，交由适配层兜底成 500
  let p = decodeURIComponent(opts.urlPath || '/');
  if (p === '/') p = '/index.html';

  // 虚拟路由：无尾斜杠时 302 到带尾斜杠，保证相对路径 ./assets 正确解析为 /_axviewer/assets
  if (p === '/_axviewer') {
    return { status: 302, headers: { Location: '/_axviewer/' }, body: null, stream: null };
  }
  if (p === '/_axviewer/') {
    return plain(200, getViewerHtml(), 'text/html; charset=utf-8');
  }
  // 工作台 UI 静态资源（Vue 构建产物 assets 等），与 AxHub 页面同源；
  // 仅此路径对跨源请求按需回显 Origin（无 Origin 的同源请求不发 CORS 头）
  if (p.startsWith('/_axviewer/')) {
    const sub = p.slice('/_axviewer/'.length);
    const full = safeJoin(VIEWER_DIR, sub);
    if (!full) return plain(403, 'Forbidden', 'text/plain; charset=utf-8');
    return fileResponse(method, full, undefined, headers.origin || null, root);
  }
  if (p === '/_api/tree' || p === '/_api/tree/') {
    // 不带 CORS 头：页面清单含本地目录信息，禁止任意网页跨源读取
    return plain(200, JSON.stringify(scanAxHub(root)), 'application/json; charset=utf-8');
  }
  if (p === '/_api/ping') return plain(200, 'ok', 'text/plain');

  // 静态服务根目录
  const full = safeJoin(root, p);
  if (!full) return plain(403, 'Forbidden', 'text/plain; charset=utf-8');
  const r = fileResponse(method, full, undefined, undefined, root);
  if (r.file) return withContent(method, headers, r);
  return r;
}

// 在 fileResponse 的头描述符上补齐 206/416/HEAD/流式取数策略
function withContent (method, headers, r) {
  const total = r.total;
  const range = headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end >= total) end = total - 1;
    if (start > end) {
      return { status: 416, headers: { 'Content-Range': 'bytes */' + total }, body: null, stream: null };
    }
    const h = Object.assign({}, r.headers, {
      'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
      'Content-Length': end - start + 1
    });
    // Range 区间通常很小（媒体拖动按窗口请求），直接读区间为 Buffer，协议层与 HTTP 层共用
    const buf = Buffer.alloc(end - start + 1);
    const fd = fs.openSync(r.file, 'r');
    try { fs.readSync(fd, buf, 0, buf.length, start); } finally { fs.closeSync(fd); }
    return { status: 206, headers: h, body: method === 'HEAD' ? null : buf, stream: null };
  }
  r.headers['Content-Length'] = total;
  if (method === 'HEAD') return { status: r.status, headers: r.headers, body: null, stream: null };
  // stream 与 file 成对返回：HTTP 适配层直接 pipe Node 流；
  // Electron 协议层忽略 stream、改用 file 走 net.fetch(file://)（Readable.toWeb 经协议层会得到空 body）
  return { status: r.status, headers: r.headers, body: null, stream: fs.createReadStream(r.file), file: r.file };
}

module.exports = {
  setRoot, getRoot, handleRequest, scanAxHub, safeJoin, getViewerHtml, mimeOf,
  VIEWER_DIR, viewerIndexFile
};
