'use strict';
/*
 * AxHub 原型工作台 · 桌面端主进程（Electron） v1.0.1
 * --------------------------------------------------------------
 * 复用本地服务（桌面端自有副本）：require('./axhub-server.js').startServer(dir)
 * 在本进程内起一个零依赖 http 服务（根目录 = AxHub 导出目录），
 * 再用 BrowserWindow 打开 http://localhost:<port>/_axviewer。
 *
 * 首次启动（或未记住目录）显示 picker.html 让用户选择 AxHub 导出目录；
 * 选择后写入 userData/axhub-desktop.json，下次直接进工作台。
 *
 * HTTP 版已按用户要求移除（仅保留 AxHub-HTTP-Server.zip 交付）；
 * 服务（axhub-server.js）复用本地 HTTP 服务，工作台 UI 为 Vue 构建产物 viewer-dist，均为 desktop/ 桌面端自有文件。
 */
const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const VERSION = '1.0.6';

// 日志写到 userData，方便用户排查启动问题
const LOG_FILE = path.join(app.getPath('userData'), 'axhub-main.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (e) { /* ignore */ }
  console.log(line);
}

// 服务为桌面端自有文件（同目录副本）；打包后 extraResources 同时把副本放入 resources 目录，二者都兼容。
let SERVER = null;
let SERVER_LOAD_ERROR = null;
try {
  const devPath = path.join(__dirname, 'axhub-server.js');
  log('try load server from', devPath);
  SERVER = require(devPath);
  log('server loaded (dev):', devPath);
} catch (e) {
  SERVER_LOAD_ERROR = e;
  try {
    const prodPath = path.join(process.resourcesPath, 'axhub-server.js');
    log('dev load failed, try prod path:', prodPath, 'error:', e.message);
    SERVER = require(prodPath);
    log('server loaded (prod):', prodPath);
  } catch (e2) {
    log('FATAL: cannot load axhub-server.js from dev or prod path:', e2.message);
  }
}

const PRELOAD = path.join(__dirname, 'preload.js');
const CONFIG = path.join(app.getPath('userData'), 'axhub-desktop.json');

log('main.js VERSION=', VERSION);
log('__dirname=', __dirname);
log('process.resourcesPath=', process.resourcesPath);
log('preload=', PRELOAD);
log('config=', CONFIG);

let win = null;
let server = null;
let savedDir = loadDir();

function loadDir() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')).dir || null; }
  catch (e) { return null; }
}
function saveDir(d) {
  try { fs.writeFileSync(CONFIG, JSON.stringify({ dir: d }, null, 2)); } catch (e) { /* ignore */ }
}

function createWindow() {
  const w = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    backgroundColor: '#f4efe6',
    show: false,
    title: 'AxHub 原型工作台',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, webSecurity: false }
  });
  w.once('ready-to-show', () => w.show());
  w.on('closed', () => { win = null; });
  return w;
}

function httpPing(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: body.slice(0, 200) }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('ping timeout')); });
  });
}

async function openViewer(d) {
  const w = win || createWindow();
  win = w;
  savedDir = d; saveDir(d);
  if (server) { try { server.close(); } catch (e) { log('close old server error:', e.message); } server = null; }

  if (!SERVER || !SERVER.startServer) {
    log('FATAL: SERVER module invalid', SERVER);
    dialog.showErrorBox('无法启动本地服务', '未找到本地服务模块 axhub-server.js。详情请查看日志：\n' + LOG_FILE);
    return;
  }

  try {
    log('startServer dir=', d);
    server = await SERVER.startServer(d, { port: 0, open: false });
    const addrInfo = server.address();
    const port = addrInfo.port;
    log('server address info', addrInfo);

    // 预检：先请求一次 /_api/ping，确认服务真的可用
    log('ping /_api/ping ...');
    const ping = await httpPing(port, '/_api/ping');
    log('ping result', ping);
    if (ping.status !== 200) {
      throw new Error('服务预检失败，状态码 ' + ping.status + ': ' + ping.body);
    }

    // 再预检工作台首页
    log('ping /_axviewer/ ...');
    const idx = await httpPing(port, '/_axviewer/');
    log('index result', idx);
    if (idx.status !== 200) {
      throw new Error('工作台首页访问失败，状态码 ' + idx.status + ': ' + idx.body);
    }

    // 强制 127.0.0.1（IPv4），避免 localhost 被解析为 IPv6 ::1 导致 Electron 渲染进程连接失败 ERR_FAILED(-2)
    const url = 'http://127.0.0.1:' + port + '/_axviewer/';
    log('loadURL', url);
    // 强制当前窗口 session 直连，不经过系统代理/VPN（否则 127.0.0.1 可能被代理拒绝）
    await w.webContents.session.setProxy({ proxyRules: 'direct://' });
    log('proxy set to direct');
    await w.loadURL(url);
    log('loadURL success');
    buildMenu();
  } catch (e) {
    log('openViewer ERROR:', e && e.message, e && e.stack);
    dialog.showErrorBox('无法启动本地服务', (e && e.message || String(e)) + '\n\n日志路径：\n' + LOG_FILE);
  }
}

function pickDir() {
  return dialog.showOpenDialog(win, {
    title: '选择 AxHub 导出目录',
    message: '请选择包含 index.html 与多个 .html 页面的 AxHub / Axure 导出文件夹',
    properties: ['openDirectory']
  });
}

function buildMenu() {
  const template = [
    { label: 'AxHub 原型工作台', submenu: [
      { label: '更换 AxHub 目录', click: async () => { const r = await pickDir(); if (!r.canceled && r.filePaths[0]) openViewer(r.filePaths[0]); } },
      { type: 'separator' },
      { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
      { role: 'quit' }
    ] },
    { label: '编辑', submenu: [{ role: 'copy' }, { role: 'selectAll' }] },
    { label: '视图', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- IPC：启动屏选择目录 ----------
ipcMain.handle('picker:select', async () => {
  const r = await pickDir();
  if (r.canceled || !r.filePaths.length) return null;
  await openViewer(r.filePaths[0]);
  return r.filePaths[0];
});

// ---------- 生命周期 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    log('app ready');
    const w = createWindow();
    win = w;
    if (savedDir && fs.existsSync(savedDir)) {
      log('has savedDir', savedDir);
      await openViewer(savedDir);
    } else {
      log('no savedDir, show picker');
      w.loadFile(path.join(__dirname, 'picker.html'));
      buildMenu();
    }
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  app.on('window-all-closed', () => { if (server) { try { server.close(); } catch (e) {} } if (process.platform !== 'darwin') app.quit(); });
}
