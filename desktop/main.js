'use strict';
/*
 * AxHub 原型工作台 · 桌面端主进程（Electron）
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

// 服务为桌面端自有文件（同目录副本）；打包后 extraResources 同时把副本放入 resources 目录，二者都兼容。
let SERVER;
try { SERVER = require(path.join(__dirname, 'axhub-server.js')); }
catch (e) { SERVER = require(path.join(process.resourcesPath, 'axhub-server.js')); }
const PRELOAD = path.join(__dirname, 'preload.js');
const CONFIG = path.join(app.getPath('userData'), 'axhub-desktop.json');

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
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false }
  });
  w.once('ready-to-show', () => w.show());
  w.on('closed', () => { win = null; });
  return w;
}

async function openViewer(d) {
  const w = win || createWindow();
  win = w;
  savedDir = d; saveDir(d);
  if (server) { try { server.close(); } catch (e) {} server = null; }
  try {
    // port 传 0 → 系统分配空闲端口，避免与已运行实例冲突
    server = await SERVER.startServer(d, { port: 0, open: false });
    const port = server.address().port;
    // 直接用带尾斜杠的地址，避免 Electron loadURL 在 302 重定向上报 ERR_FAILED (-2)
    await w.loadURL('http://localhost:' + port + '/_axviewer/');
    buildMenu();
  } catch (e) {
    dialog.showErrorBox('无法启动本地服务', String(e && e.message || e));
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
    const w = createWindow();
    win = w;
    if (savedDir && fs.existsSync(savedDir)) {
      await openViewer(savedDir);
    } else {
      w.loadFile(path.join(__dirname, 'picker.html'));
      buildMenu();
    }
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  app.on('window-all-closed', () => { if (server) { try { server.close(); } catch (e) {} } if (process.platform !== 'darwin') app.quit(); });
}
