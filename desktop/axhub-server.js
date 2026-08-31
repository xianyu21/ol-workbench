#!/usr/bin/env node
/*
 * AxHub 原型工作台 · 本地服务（零依赖）
 * --------------------------------------------------------------
 * 技术栈：纯 Node 原生 http（无需 npm install），替代上一代 file:// 单文件方案。
 *
 * 解决的问题（相对原 file:// 方案）：
 *   1. AxHub 标准导出是「扁平结构」：index.html 框架 + 数百个顶级 .html 页面 + 共享 resources/data/images/files，
 *      不是「每目录一个 index.html」。file:// 下查看器与导出不在同级时，跨目录 iframe 被浏览器拦截。
 *   2. file:// 缓存利用率低，500+ 页面、几十 MB 体量下首开卡顿没根治。HTTP + 强缓存可根治。
 *   3. AxHub 部分交互依赖同源 / XHR，HTTP 下完全正常。
 *
 * 约束条件：
 *   - 零 npm 依赖，仅用 Node 内置模块。
 *   - 不污染 AxHub 导出目录：工作台 UI 在内存中生成，不落盘到用户目录。
 *   - 根目录 = AxHub 导出目录，同源服务，中文路径正确解码。
 *
 * 用法：
 *   node axhub-server.js [AxHub根目录] [--port N] [--no-open]
 *   不带参数时默认服务当前工作目录。
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

// 工作台 UI：Vue3 + antdv 构建产物目录（desktop/viewer/ → vite build → viewer-dist/）
// 开发期 __dirname = desktop/，打包后 __dirname = resources/，两种形态下 viewer-dist 都与 server 同目录。
const VIEWER_DIR = path.join(__dirname, 'viewer-dist');

// ---------- 解析参数 ----------
function parseArgs(argv) {
  let root = null, port = 0, open = true;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-open') open = false;
    else if (a === '--port' || a === '-p') { port = parseInt(argv[++i], 10) || 0; }
    else if (a === '--help' || a === '-h') { root = '__help'; }
    else if (!a.startsWith('-') && !root) { root = a; }
  }
  if (root === '__help') {
    console.log('用法: node axhub-server.js [AxHub根目录] [--port N] [--no-open]');
    process.exit(0);
  }
  return { root: root ? path.resolve(root) : process.cwd(), port, open };
}
// ROOT 在 startServer() 中按传入目录赋值；CLI 模式下由下方 require.main 守卫段赋值。
let ROOT = process.cwd();

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
function mimeOf(p) { return MIME[path.extname(p).toLowerCase()] || 'application/octet-stream'; }

// ---------- 安全路径 ----------
function safeJoin(root, reqPath) {
  // reqPath 已 decode
  const t = path.normalize(path.join(root, reqPath));
  if (t !== root && !t.startsWith(root + path.sep)) return null; // 防目录穿越
  return t;
}

// ---------- 扫描 AxHub 标准扁平导出 ----------
const FRAME_FILES = new Set(['index.html', 'start.html', 'start_c_1.html', 'start_with_pages.html', '通用组件.html', 'start_with_pages (1).html']);
function scanAxHub(root) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch (e) { return { error: '无法读取目录: ' + e.message, pages: [], root, name: path.basename(root) }; }
  const pages = [];
  let maxDepth = 0;
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const f = ent.name;
    if (!/\.html?$/i.test(f)) continue;
    const low = f.toLowerCase();
    if (FRAME_FILES.has(low)) continue;
    if (/^start[^.]*\.html?$/i.test(f)) continue; // 任何 start*.html 都是框架入口
    if (low === '通用组件.html') continue;
    let st;
    try { st = fs.statSync(path.join(root, f)); } catch (e) { continue; }
    const name = f.replace(/\.html?$/i, '');
    // AxHub 命名形如 NN-NN_页面名 或 NN-NN-NN_页面名；取首个 '-' 前作为模块分组
    const seg = name.split('-');
    const group = seg.length > 1 ? seg[0] : '未分组';
    let h = 5381; for (let i = 0; i < f.length; i++) h = ((h << 5) + h + f.charCodeAt(i)) >>> 0;
    pages.push({
      id: 'p' + h.toString(36) + '_' + f.length.toString(36),
      name, path: f, size: st.size, group, mtime: st.mtimeMs
    });
    maxDepth = Math.max(maxDepth, name.split('-').length);
  }
  pages.sort((a, b) => a.path.localeCompare(b.path, 'zh'));
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

// ---------- 静态文件响应（支持 Range / 304） ----------
function serveFile(req, res, full, status) {
  let st;
  try { st = fs.statSync(full); } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return;
  }
  if (st.isDirectory()) {
    // 尝试目录下的 index.html
    const idx = path.join(full, 'index.html');
    if (fs.existsSync(idx)) return serveFile(req, res, idx, status);
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const total = st.size;
  const type = mimeOf(full);
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'Last-Modified': st.mtime.toUTCString(),
    'Access-Control-Allow-Origin': '*'
  };
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end >= total) end = total - 1;
    if (start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + total }); res.end(); return; }
    headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + total;
    headers['Content-Length'] = end - start + 1;
    res.writeHead(206, headers);
    fs.createReadStream(full, { start, end }).pipe(res);
    return;
  }
  headers['Content-Length'] = total;
  res.writeHead(status || 200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(full).pipe(res);
}

// ---------- 读取工作台 UI（按 mtime 缓存，文件变更自动热更新，无需重启服务）----------
let VIEWER_HTML = null, VIEWER_MTIME = -1;
function viewerIndexFile() {
  // 仅 Vue 构建产物；未构建则返回 null（不再回退旧版单文件）
  const idx = path.join(VIEWER_DIR, 'index.html');
  try { fs.accessSync(idx); return idx; } catch (e) { return null; }
}
function getViewerHtml() {
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
let VIEWER_HTML_FILE = null;

// ---------- 请求处理器（CLI 与 Electron 复用）----------
function requestHandler(req, res) {
  const u = url.parse(req.url);
  let p = decodeURIComponent(u.pathname || '/');
  if (p === '/') p = '/index.html';
  // 虚拟路由：无尾斜杠时 302 到带尾斜杠，保证相对路径 ./assets 正确解析为 /_axviewer/assets
  if (p === '/_axviewer') {
    res.writeHead(302, { 'Location': '/_axviewer/' }); res.end(); return;
  }
  if (p === '/_axviewer/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(getViewerHtml()); return;
  }
  // 工作台 UI 静态资源（Vue 构建产物 assets 等），与 AxHub 页面同源
  if (p.startsWith('/_axviewer/')) {
    const sub = p.slice('/_axviewer/'.length);
    const full = safeJoin(VIEWER_DIR, sub);
    if (!full) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Forbidden'); return; }
    serveFile(req, res, full); return;
  }
  if (p === '/_api/tree' || p === '/_api/tree/') {
    const data = scanAxHub(ROOT);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data)); return;
  }
  if (p === '/_api/ping') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  // 静态服务根目录
  const full = safeJoin(ROOT, p);
  if (!full) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Forbidden'); return; }
  serveFile(req, res, full);
}

// ---------- 启动（可被 require 复用）----------
// 返回 Promise<server>；port 为 0 时由系统分配空闲端口。
function startServer(root, opts) {
  opts = opts || {};
  ROOT = path.resolve(root || process.cwd());
  const port = opts.port || 0;
  const open = opts.open !== false;
  return new Promise((resolve, reject) => {
    const srv = http.createServer(requestHandler);
    srv.on('error', (e) => {
      if (e.code === 'EADDRINUSE') console.error('端口被占用，请用 --port 指定其他端口，例如 --port 8123');
      else console.error('启动失败: ' + e.message);
      reject(e);
    });
    srv.listen(port, () => {
      const p = srv.address().port;
      const addr = 'http://localhost:' + p + '/_axviewer';
      console.log('────────────────────────────────────────────');
      console.log(' AxHub 原型工作台 · 本地服务已启动');
      console.log(' 数据源 : ' + ROOT);
      console.log(' 工作台 : ' + addr);
      console.log('────────────────────────────────────────────');
      console.log(' 按 Ctrl+C 停止');
      if (open) {
        const cmd = process.platform === 'win32'
          ? 'cmd /c start "" "' + addr + '"'
          : process.platform === 'darwin' ? 'open "' + addr + '"'
            : 'xdg-open "' + addr + '"';
        exec(cmd, (err) => { if (err) console.log('(未能自动打开浏览器，请手动访问 ' + addr + ')'); });
      }
      resolve(srv);
    });
  });
}

module.exports = { startServer, scanAxHub, safeJoin, getViewerHtml, requestHandler };

// ---------- CLI 入口（仅 node axhub-server.js 直接运行时执行）----------
if (require.main === module) {
  const ARGS = parseArgs(process.argv);
  startServer(ARGS.root, { port: ARGS.port, open: ARGS.open }).catch(() => process.exit(1));
}
