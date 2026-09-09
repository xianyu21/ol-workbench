#!/usr/bin/env node
/*
 * AxHub 原型工作台 · 本地服务（零依赖） v1.1.0
 * --------------------------------------------------------------
 * 技术栈：纯 Node 原生 http（无需 npm install）。
 *
 * 自 v1.1.0 起，路由/静态服务/扫描逻辑全部在 serve-core.js（宿主无关核心），
 * 本文件只是它的 Node http 适配层 + CLI 入口：桌面端（Electron）已改用
 * axhub:// 自定义协议直连 serve-core，不再经过本 HTTP 服务；本文件保留用于
 * CLI 浏览器模式（node axhub-server.js [目录]）与 AxHub-HTTP-Server.zip 交付。
 *
 * 用法：
 *   node axhub-server.js [AxHub根目录] [--port N] [--no-open]
 *   不带参数时默认服务当前工作目录。
 */
'use strict';
const VERSION = '1.1.0';
const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const core = require('./serve-core.js');

console.log('[axhub-server] viewer-dist:', core.VIEWER_DIR, 'exists:', fs.existsSync(core.VIEWER_DIR));

// ---------- 解析参数 ----------
function parseArgs (argv) {
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

// ---------- HTTP 适配层：核心描述符 → Node 响应 ----------
function requestHandler (req, res) {
  try {
    const u = url.parse(req.url);
    const r = core.handleRequest({ root: core.getRoot(), method: req.method, urlPath: u.pathname || '/', headers: req.headers });
    res.writeHead(r.status, r.headers);
    if (r.stream) { r.stream.pipe(res); return; }
    res.end(r.body === null || r.body === undefined ? undefined : r.body);
  } catch (err) {
    console.error('[axhub-server] requestHandler error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error: ' + (err && err.message || String(err)));
    } else {
      try { res.end(); } catch (e) { /* socket 已断 */ }
    }
  }
}

// ---------- 启动（可被 require 复用） ----------
// 返回 Promise<server>；port 为 0 时由系统分配空闲端口。
function startServer (root, opts) {
  opts = opts || {};
  const dir = path.resolve(root || process.cwd());
  core.setRoot(dir);
  const port = opts.port || 0;
  const open = opts.open !== false;
  return new Promise((resolve, reject) => {
    const srv = http.createServer(requestHandler);
    srv.on('error', (e) => {
      if (e.code === 'EADDRINUSE') console.error('端口被占用，请用 --port 指定其他端口，例如 --port 8123');
      else console.error('启动失败: ' + e.message);
      reject(e);
    });
    srv.listen(port, '127.0.0.1', () => {
      const p = srv.address().port;
      const addr = 'http://127.0.0.1:' + p + '/_axviewer';
      console.log('────────────────────────────────────────────');
      console.log(' AxHub 原型工作台 · 本地服务已启动  v' + VERSION);
      console.log(' 数据源 : ' + dir);
      console.log(' 工作台 : ' + addr);
      console.log(' viewer-dist : ' + core.VIEWER_DIR + ' (exists=' + fs.existsSync(core.VIEWER_DIR) + ')');
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

// 兼容旧导出形态（测试与外部脚本引用的是 axhub-server.js 的这些名字）
module.exports = { startServer, requestHandler, scanAxHub: core.scanAxHub, safeJoin: core.safeJoin, getViewerHtml: core.getViewerHtml, core };

// ---------- CLI 入口（仅 node axhub-server.js 直接运行时执行） ----------
if (require.main === module) {
  const ARGS = parseArgs(process.argv);
  startServer(ARGS.root, { port: ARGS.port, open: ARGS.open }).catch(() => process.exit(1));
}
