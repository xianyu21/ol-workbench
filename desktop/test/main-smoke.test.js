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
