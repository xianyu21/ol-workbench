'use strict';
/*
 * AxHub 原型工作台 · 桌面端入口（Electron） v1.2.0
 * --------------------------------------------------------------
 * 仅做「依赖注入 + 装配」：注册特权 scheme（必须在 app ready 前），
 * 把原生依赖与配置注入 src/app.js 的 start()。所有业务/状态逻辑下沉到 src/。
 */
const { app, protocol } = require('electron');
const path = require('path');
const { start } = require('./src/app.js');

// axhub:// 自定义协议：standard+secure 使相对路径/同源判定/localStorage 语义与 https 一致，
// supportFetchAPI 供 Axure 页内 XHR/fetch 使用，stream 供大文件流式返回。
protocol.registerSchemesAsPrivileged([{
  scheme: 'axhub',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}]);

// 注入所有原生依赖与配置（版本号单源来自 package.json，经 app.getVersion() 读取）
start({
  app,
  BrowserWindow: require('electron').BrowserWindow,
  dialog: require('electron').dialog,
  ipcMain: require('electron').ipcMain,
  Menu: require('electron').Menu,
  Tray: require('electron').Tray,
  nativeImage: require('electron').nativeImage,
  shell: require('electron').shell,
  protocol,
  net: require('electron').net,
  autoUpdater: require('electron-updater').autoUpdater,
  viewerDir: path.join(__dirname, 'viewer-dist'),
  resourcesPath: process.resourcesPath,
  isPackaged: app.isPackaged,
  userDataPath: app.getPath('userData'),
  VERSION: app.getVersion(),
  PORTABLE: !!process.env.PORTABLE_EXECUTABLE_DIR,
  RELEASES_URL: 'https://github.com/xianyu21/ol-workbench/releases',
  PRELOAD: path.join(__dirname, 'preload.js')
});
