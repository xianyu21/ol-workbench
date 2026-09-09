'use strict';
/*
 * AxHub 原型工作台 · 桌面端主进程（Electron） v1.1.0
 * --------------------------------------------------------------
 * 自 v1.1.0 起桌面端不再内嵌 HTTP 服务（不监听任何端口）：axhub-server.js 的
 * 路由/静态服务逻辑抽到了宿主无关的 serve-core.js，本进程把 serve-core 挂到
 * 自定义协议 axhub:// 上（standard + secure + supportFetchAPI + stream），
 * BrowserWindow 直接打开 axhub://local/_axviewer/。
 * viewer 与原型页同在 axhub://local 一个 origin 下，iframe 同源联动、相对路径、
 * Range 媒体播放与原 HTTP 版行为一致；页面清单经 IPC（tree:get）获取。
 *
 * 首次启动（或未记住目录）显示 picker.html 让用户选择 AxHub 导出目录；
 * 选择后写入 userData/axhub-desktop.json，下次直接进工作台。
 */
const { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');
const userStore = require('./user-store.js');
const core = require('./serve-core.js');

// ---------- axhub:// 自定义协议 ----------
// 必须在 app ready 之前注册特权 scheme；standard+secure 使相对路径/同源判断/
// localStorage 与 https 站点语义一致，supportFetchAPI 供 Axure 页内 XHR/fetch 使用。
const AXHUB_SCHEME = 'axhub';
const AXHUB_ORIGIN = 'axhub://local'; // 固定 origin：与端口彻底解耦，localStorage 永不漂移
protocol.registerSchemesAsPrivileged([{
  scheme: AXHUB_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}]);

// serve-core 描述符 → web Response 的薄适配
function registerAxhubProtocol () {
  protocol.handle(AXHUB_SCHEME, async (req) => {
    try {
      const u = new URL(req.url);
      const headers = {};
      for (const [k, v] of req.headers.entries()) headers[k.toLowerCase()] = v;
      const r = core.handleRequest({ root: core.getRoot(), method: req.method, urlPath: u.pathname, headers });
      const init = { status: r.status, headers: r.headers };
      if (r.file) {
        // 无 Range 的静态文件：net.fetch(file://) 返回协议层可正确消费的 web 流
        // （Readable.toWeb(fs.createReadStream) 实测经协议层后 body 为空，不可用）
        try {
          const fres = await net.fetch(pathToFileURL(r.file).toString());
          init.body = fres.body;
        } catch (e) {
          log('axhub stream fallback to buffer:', r.file, e && e.message);
          init.body = await fs.promises.readFile(r.file);
        }
      } else if (r.body !== null && r.body !== undefined) {
        init.body = r.body;
      }
      return new Response(init.body ?? null, init);
    } catch (err) {
      log('axhub protocol error:', err && err.message);
      return new Response('Internal Server Error: ' + (err && err.message || String(err)), {
        status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  });
}

// 版本号单源：读自 package.json（electron-builder 同源），发版只改一处
const VERSION = app.getVersion();
// portable 版由 electron-builder 运行时注入该环境变量；不支持自动更新，检查到新版本只给下载指引
const PORTABLE = !!process.env.PORTABLE_EXECUTABLE_DIR;
const RELEASES_URL = 'https://github.com/xianyu21/ol-workbench/releases';

// 本机环境两处启动崩溃均已实测定位并验证修复：
// 1) GPU 进程反复崩溃（0x80000003）连崩 6 次后 Chromium FATAL 退出（"GPU process isn't usable."）
//    → in-process-gpu + 禁用硬件加速
// 2) 安全软件向沙箱渲染进程注入 DLL，渲染进程启动即崩（loadURL 报 ERR_FAILED(-2)，
//    仅 Program 目录安装版复现，解包版不触发）→ 关闭渲染进程沙箱。
//    渲染层 contextIsolation 开启、nodeIntegration 关闭，仅加载本地同源内容，关沙箱风险可控。
// 另：崩溃报告（CrashSender.exe）被拦截时会二次弹框，一并关闭。
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-crash-reporter');
app.commandLine.appendSwitch('disable-crashpad');

// ---------- 在线更新 ----------
// 发布源在 package.json build.publish 配置（generic provider，指向存放 latest.yml + exe 的目录）。
// 未签名应用：win 仅 NSIS 安装版支持自动更新，portable 版需重新下载。
function setupAutoUpdater() {
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };
  autoUpdater.autoDownload = false; // 下载前询问用户

  let downloading = false;

  autoUpdater.on('update-available', async (info) => {
    log('update available:', info && info.version, PORTABLE ? '(portable)' : '');
    if (!win) return;
    // GitHub Release 的 body 即更新内容；可能是 markdown/html，去标签后展示
    let notes = info && (info.releaseNotes || '');
    if (typeof notes === 'object' && notes) notes = notes.content || ''; // html 形态 {content}
    notes = String(notes).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    if (PORTABLE) {
      // portable 版无法自动更新，给明确指引而不是下载询问
      const r = await dialog.showMessageBox(win, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 v${info.version}（当前 v${VERSION}）。`,
        detail: (notes ? `更新内容：\n\n${notes}\n\n` : '') + '便携版不支持自动更新，请到 Releases 页面重新下载。',
        buttons: ['打开 Releases 页面', '以后再说'], defaultId: 0, cancelId: 1
      });
      if (r.response === 0) shell.openExternal(RELEASES_URL).catch(() => {});
      return;
    }
    const detail = notes ? `更新内容：\n\n${notes}\n\n` : '';
    const r = await dialog.showMessageBox(win, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 v${info.version}（当前 v${VERSION}），是否下载更新？`,
      detail,
      buttons: ['立即下载', '以后再说'],
      defaultId: 0, cancelId: 1
    });
    if (r.response !== 0 || downloading) return;
    downloading = true;
    try {
      await autoUpdater.downloadUpdate(); // 完成后由 update-downloaded 事件接管安装
    } catch (e) {
      downloading = false;
      log('download error:', e && e.message);
      if (win) dialog.showErrorBox('更新失败', '下载更新失败：\n' + (e && e.message || e));
    }
  });

  autoUpdater.on('download-progress', (p) => {
    if (win && p && p.percent != null) {
      win.setTitle(`AxHub 原型工作台 · 正在下载更新 ${Math.round(p.percent)}%`);
      // 页面内进度提示（窗口标题太容易被忽略）
      try { win.webContents.send('update:progress', Math.round(p.percent)); } catch (e) {}
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    if (win) win.setTitle('AxHub 原型工作台');
    log('update downloaded, quitAndInstall');
    quitting = true; // 放行窗口 close，避免被关闭询问拦截
    try { await autoUpdater.quitAndInstall(false, true); } catch (e) { log('install error:', e && e.message); }
  });

  autoUpdater.on('error', (e) => {
    downloading = false;
    if (win) {
      win.setTitle('AxHub 原型工作台');
      try { win.webContents.send('update:progress', null); } catch (e2) {}
    }
    // 静默：无网络/无更新源时只在日志记录
    log('autoUpdater error:', e && e.message);
  });

  // 启动 5 秒后静默检查一次，此后每 24 小时再查一次（长期后台运行也能及时知道新版本）
  const checkSilently = () => {
    log('checkForUpdates...');
    autoUpdater.checkForUpdates().catch(() => {});
  };
  setTimeout(checkSilently, 5000);
  setInterval(checkSilently, 24 * 60 * 60 * 1000);
}

// 日志写到 userData，方便用户排查启动问题；超 1MB 自动轮转保留一份 .old，防止无限增长
const LOG_FILE = path.join(app.getPath('userData'), 'axhub-main.log');
const LOG_MAX_BYTES = 1024 * 1024;
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
  try {
    try {
      if (fs.statSync(LOG_FILE).size > LOG_MAX_BYTES) {
        try { fs.unlinkSync(LOG_FILE + '.old'); } catch (e) { /* 不存在 */ }
        fs.renameSync(LOG_FILE, LOG_FILE + '.old');
      }
    } catch (e) { /* 文件不存在，直接写 */ }
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) { /* ignore */ }
  console.log(line);
}

const PRELOAD = path.join(__dirname, 'preload.js');
const CONFIG = path.join(app.getPath('userData'), 'axhub-desktop.json');
userStore.init(app.getPath('userData')); // 用户核心数据落盘（收藏/标签/最近访问/标签页布局）

log('main.js VERSION=', VERSION);
log('__dirname=', __dirname);
log('process.resourcesPath=', process.resourcesPath);
log('preload=', PRELOAD);
log('config=', CONFIG);

let win = null;
let savedDir = loadDir();
let tray = null;
let quitting = false; // 真正退出（托盘退出/更新安装）时置 true，放行 close

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')) || {}; }
  catch (e) { return {}; }
}
function saveConfig(patch) {
  try {
    const cfg = Object.assign(loadConfig(), patch);
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
  } catch (e) { /* ignore */ }
}
function loadDir() { return loadConfig().dir || null; }
function saveDir(d) { saveConfig({ dir: d }); }

// ---------- 托盘（后台运行） ----------
function trayIconPath() {
  const dev = path.join(__dirname, 'build', 'icon.ico');
  if (fs.existsSync(dev)) return dev;
  return path.join(process.resourcesPath, 'build', 'icon.ico');
}
function ensureTray() {
  if (tray) return tray;
  try {
    const img = nativeImage.createFromPath(trayIconPath());
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip('AxHub 原型工作台（后台运行中）');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开工作台', click: () => showMainWindow() },
      { type: 'separator' },
      { label: '退出', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('double-click', () => showMainWindow());
    return tray;
  } catch (e) { log('tray create error:', e && e.message); return null; }
}
function showMainWindow() {
  if (!win) { openViewer(savedDir); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ---------- 关闭行为：询问后台运行还是直接退出，可记住选择 ----------
// 优先由页面弹 antd Modal（样式统一）；页面未就绪时回退系统对话框
function handleClose(w, e) {
  if (quitting) return; // 放行真正退出
  const action = loadConfig().closeAction; // 'background' | 'exit' | undefined(每次问)
  if (action === 'background') { e.preventDefault(); w.hide(); ensureTray(); return; }
  if (action === 'exit') return; // 直接退出
  e.preventDefault();
  if (w.webContents && !w.webContents.isDestroyed() && !w.webContents.isLoading()) {
    w.webContents.send('close:ask');
  } else {
    nativeAskClose(w);
  }
}
function nativeAskClose(w) {
  dialog.showMessageBox(w, {
    type: 'question', title: '关闭 AxHub 原型工作台',
    message: '要在后台继续运行，还是直接退出？',
    detail: '后台运行将最小化到系统托盘，可随时从托盘重新打开。',
    buttons: ['后台运行', '直接退出', '取消'], defaultId: 0, cancelId: 2
  }).then(r => {
    if (r.response === 2) return;
    if (r.response === 0) { w.hide(); ensureTray(); } else { quitting = true; app.quit(); }
  });
}
ipcMain.on('close:apply', (e, action, remember) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  if (remember) saveConfig({ closeAction: action });
  if (action === 'background') { w.hide(); ensureTray(); } else { quitting = true; app.quit(); }
});
// 设置页改关闭行为：仅保存，不触发动作（'' = 每次询问）
ipcMain.on('close:save', (e, action) => saveConfig({ closeAction: action || '' }));

// ---------- IPC：用户核心数据磁盘持久化 ----------
// preload 启动时 sendSync 拉取一次（磁盘为事实来源；文件缺失返回 null，渲染层保留现有 localStorage = 旧数据自动迁移）
ipcMain.on('user-data:load-sync', (e) => { e.returnValue = userStore.load(); });
ipcMain.on('user-data:save', (e, data) => userStore.save(data));
ipcMain.on('user-data:clear', () => userStore.clear());

function createWindow() {
  const w = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    backgroundColor: '#f4efe6',
    show: false,
    title: 'AxHub 原型工作台',
    // webSecurity 保持默认开启：工作台与原型页同在 axhub://local 一个 origin 下，无需关闭。
    // 若个别导出确需跨域，由 serve-core 精确放行（/_axviewer 资源按需回显 Origin），不走全局关闭。
    // sandbox:false：preload 需 require 本地模块（user-keys.js / user-store 桥），
    // 沙箱化 preload 不支持相对 require（报 module not found → window.axhub 整个缺失）。
    // 已全局 no-sandbox + contextIsolation 开启 + nodeIntegration 关闭 + 仅本地同源内容，风险可控。
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  w.once('ready-to-show', () => w.show());
  w.on('close', (e) => handleClose(w, e));
  w.on('closed', () => { win = null; });
  return w;
}

async function openViewer (d) {
  const w = win || createWindow();
  win = w;
  savedDir = d; saveDir(d);

  // serve-core 挂上当前导出目录，并先做一次可读性校验（代替旧 HTTP 预检）
  core.setRoot(d);
  if (d) {
    const scan = core.scanAxHub(d);
    if (scan.error) {
      log('openViewer: scan error:', scan.error);
      dialog.showErrorBox('无法读取 AxHub 导出目录', scan.error + '\n\n目录：\n' + d + '\n\n日志路径：\n' + LOG_FILE);
      return;
    }
    log('scan ok, pages =', scan.pages.length);
  } else {
    log('no dir: open empty workspace');
  }

  // 强制当前窗口 session 直连，不经过系统代理/VPN（页面内的外链资源也保持直连）
  try { await w.webContents.session.setProxy({ proxyRules: 'direct://' }); } catch (e) { log('setProxy error:', e && e.message); }

  // 固定 origin（AXHUB_ORIGIN 与端口彻底解耦），localhost 拦截/端口漂移类问题不复存在
  const target = AXHUB_ORIGIN + '/_axviewer/';
  try {
    log('loadURL', target);
    await w.loadURL(target);
    log('loadURL success');
    buildMenu();
  } catch (e) {
    log('loadURL failed:', e && e.message, e && e.stack);
    dialog.showErrorBox('无法打开工作台', (e && e.message || String(e)) + '\n\n日志路径：\n' + LOG_FILE);
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
  // 移除默认应用菜单栏（AxHub 原型工作台 / 编辑 / 视图）
  Menu.setApplicationMenu(null);
}

// ---------- IPC：页面清单（协议层不可被本机其他进程访问，清单只经 IPC 给渲染层） ----------
// 未关联目录（首次启动 / 已移除）时返回空清单，工作台以空态 + 引导弹窗呈现
ipcMain.handle('tree:get', () => {
  const root = core.getRoot();
  if (!root) return { name: '', root: null, entry: null, hasData: false, pages: [] };
  return core.scanAxHub(root);
});

// ---------- IPC：移除 AxHub 目录（只解绑 + 清配置，不删磁盘文件） ----------
// 渲染层已先清空本地记录（userData.clear()），此处清掉目录绑定后重载为空态工作台
ipcMain.handle('dir:clear', async () => {
  log('dir:clear');
  try { await openViewer(null); } catch (e) { log('dir:clear reload error:', e && e.message); }
  return true;
});

// ---------- IPC：启动屏选择目录 ----------
ipcMain.handle('picker:select', async () => {
  const r = await pickDir();
  if (r.canceled || !r.filePaths.length) return null;
  await openViewer(r.filePaths[0]);
  return r.filePaths[0];
});

// ---------- IPC：版本号 / 手动检查更新 ----------
ipcMain.handle('app:version', () => VERSION);
ipcMain.handle('update:check', async () => {
  try {
    const r = await autoUpdater.checkForUpdates();
    const info = r && r.updateInfo;
    if (!info) return { ok: false, error: '无法获取更新信息' };
    // 有新版本时 update-available 事件会弹窗展示更新内容并询问下载
    return { ok: true, available: info.version !== VERSION, version: info.version, portable: PORTABLE };
  } catch (e) {
    log('manual check error:', e && e.message);
    return { ok: false, error: (e && e.message || String(e)).split('\n')[0].slice(0, 160) };
  }
});

// ---------- 生命周期 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => showMainWindow());
  app.whenReady().then(async () => {
    log('app ready');
    registerAxhubProtocol();
    setupAutoUpdater();
    const w = createWindow();
    win = w;
    if (savedDir && fs.existsSync(savedDir)) {
      log('has savedDir', savedDir);
      await openViewer(savedDir);
    } else {
      // 无目录（首次启动 / 目录已被移除）：直接进空态工作台，由页面弹窗引导添加目录
      log('no savedDir, open empty workspace');
      await openViewer(null);
    }
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  // 更新安装/托盘退出走 app.quit() → before-quit 放行窗口 close，并把待写数据立即落盘
  app.on('before-quit', () => { quitting = true; userStore.flush(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
