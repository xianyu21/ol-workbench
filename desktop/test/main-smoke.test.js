'use strict';
/*
 * 主进程装配烟雾测试：用 mock 注入全部原生依赖，调用 app.start() 验证协议注册 +
 * IPC 注册 + 更新装配「不真正起 Electron」也不抛异常。运行：
 * cd desktop && node --test test/main-smoke.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { start } = require('../src/app.js');

/* mock ipcMain */
function mockIpcMain () {
  const handles = {};
  const ons = {};
  return {
    handle: (ch, fn) => { handles[ch] = fn; },
    on: (ch, fn) => { (ons[ch] = ons[ch] || []).push(fn); },
    handles, ons
  };
}

function buildMocks () {
  let protoScheme = null;
  let protoHandler = null;
  const ipcMain = mockIpcMain();
  const app = {
    getVersion: () => '9.9.9',
    isPackaged: false,
    getPath: () => os.tmpdir(),
    whenReady: async () => {},
    on: () => {},
    requestSingleInstanceLock: () => true,
    disableHardwareAcceleration: () => {},
    commandLine: { appendSwitch: () => {} },
    quit: () => {}
  };
  class BrowserWindow {
    constructor () {
      this.webContents = { send () {}, session: { setProxy: async () => {} }, isDestroyed: () => false, isLoading: () => false, loadURL: async () => {} };
    }
    on () {} once () {} show () {} restore () {} focus () {} isMinimized () { return false; } hide () {}
    static getAllWindows () { return []; }
    static fromWebContents () { return null; }
  }
  const dialog = {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showErrorBox () {},
    showMessageBox: async () => ({ response: 0 })
  };
  const Menu = { setApplicationMenu () {}, buildFromTemplate: (t) => t };
  class Tray { constructor () {} setToolTip () {} setContextMenu () {} on () {} }
  const nativeImage = { createFromPath: () => ({ isEmpty: () => true }), createEmpty: () => ({}) };
  const shell = { openExternal: async () => {} };
  const protocol = {
    registerSchemesAsPrivileged () {},
    handle: (scheme, fn) => { protoScheme = scheme; protoHandler = fn; }
  };
  const net = { fetch: async () => ({ body: null }) };
  const autoUpdater = {
    logger: {}, on () {}, checkForUpdates: async () => ({ updateInfo: { version: '1' } }),
    autoDownload: true, autoInstallOnAppQuit: true, downloadUpdate: async () => {}, quitAndInstall () {}
  };
  const viewerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-vd-'));
  return { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage, shell, protocol, net, autoUpdater, viewerDir, getProto: () => ({ scheme: protoScheme, handler: protoHandler }) };
}

test('main-smoke：start 装配不抛异常，协议与 IPC 正确注册', async () => {
  const m = buildMocks();
  // 屏蔽 updater 的 setTimeout/setInterval，避免烟雾测试进程挂起
  const realSetTimeout = global.setTimeout;
  const realSetInterval = global.setInterval;
  global.setTimeout = () => 0;
  global.setInterval = () => 0;
  try {
    await start({
      app: m.app, BrowserWindow: m.BrowserWindow, dialog: m.dialog, ipcMain: m.ipcMain,
      Menu: m.Menu, Tray: m.Tray, nativeImage: m.nativeImage, shell: m.shell,
      protocol: m.protocol, net: m.net, autoUpdater: m.autoUpdater,
      viewerDir: m.viewerDir, VERSION: '9.9.9', PORTABLE: false,
      RELEASES_URL: 'https://example.test', PRELOAD: 'preload.js', userDataPath: os.tmpdir()
    });
  } finally {
    global.setTimeout = realSetTimeout;
    global.setInterval = realSetInterval;
  }
  const proto = m.getProto();
  assert.strictEqual(proto.scheme, 'axhub', '协议应注册为 axhub://');
  assert.strictEqual(typeof proto.handler, 'function', '协议 handler 应为函数');
  assert.ok(m.ipcMain.handles['tree:get'], 'tree:get 应已注册');
  assert.ok(m.ipcMain.handles['app:version'], 'app:version 应已注册');
  assert.ok(m.ipcMain.ons['user-data:load-sync'], 'user-data:load-sync 应已注册');
  assert.strictEqual(await m.ipcMain.handles['app:version'](), '9.9.9');
});

/*
 * 回归守门：v1.4.0 线上安装版报「找不到工作台 UI」的根因是 main.js 无条件把
 * viewerDir 拼成 __dirname/viewer-dist。打包后 __dirname 落在 asar 内，而
 * viewer-dist 由 extraResources 放在 asar 外的 resources/viewer-dist，
 * build.files 又不含它 → 主进程指向不存在的路径 → serve-core 渲染兜底错误页。
 * 本用例锁定「packaged 时 viewerDir 必须解析到 resourcesPath 下」。
 */
test('main-smoke：packaged 时 viewerDir 解析到 resourcesPath/viewer-dist', async () => {
  const m = buildMocks();
  m.app.isPackaged = true;
  const resourcesPath = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-res-'));
  const realSetTimeout = global.setTimeout;
  const realSetInterval = global.setInterval;
  global.setTimeout = () => 0;
  global.setInterval = () => 0;
  try {
    // 不传 viewerDir：模拟 main.js 交给 app.js defaultViewerDir 决策的路径
    await start({
      app: m.app, BrowserWindow: m.BrowserWindow, dialog: m.dialog, ipcMain: m.ipcMain,
      Menu: m.Menu, Tray: m.Tray, nativeImage: m.nativeImage, shell: m.shell,
      protocol: m.protocol, net: m.net, autoUpdater: m.autoUpdater,
      isPackaged: true, resourcesPath, VERSION: '9.9.9', PORTABLE: false,
      RELEASES_URL: 'https://example.test', PRELOAD: 'preload.js', userDataPath: os.tmpdir()
    });
  } finally {
    global.setTimeout = realSetTimeout;
    global.setInterval = realSetInterval;
  }
  const core = require('../serve-core.js');
  assert.strictEqual(
    core.getViewerDir(),
    path.join(resourcesPath, 'viewer-dist'),
    'packaged 时 viewerDir 必须指向 resourcesPath/viewer-dist（asar 内无此目录）'
  );
});

/* 源码级守门：main.js 不得再把 viewerDir 无条件拼成 __dirname/viewer-dist */
test('main-smoke：main.js 的 viewerDir 注入按 isPackaged 分流', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(src, /viewerDir:\s*app\.isPackaged/, 'main.js 必须按 isPackaged 分流 viewerDir');
  assert.doesNotMatch(
    src,
    /viewerDir:\s*path\.join\(__dirname,\s*'viewer-dist'\),/,
    'main.js 不得无条件拼 __dirname/viewer-dist（打包后指向 asar 内不存在路径）'
  );
});
