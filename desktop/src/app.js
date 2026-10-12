'use strict';
/*
 * 应用装配器（App）：把协议 / IPC / 更新 / 窗口 / 托盘 / 生命周期编排起来。
 * 不持有任何电子细节：原生依赖与配置全部由 main.js 注入（options），
 * 因此本模块在 node --test 下可用 mock 注入做烟雾测试。
 */
const path = require('path');
const fs = require('fs');
const ctx = require('./context.js');
const core = require('../serve-core.js');
const userStore = require('../user-store.js');
const { registerAxhubProtocol } = require('./protocol.js');
const { registerIpc } = require('./ipc/index.js');
const { setupAutoUpdater, onBootReconcile, onWebContentsCrashed } = require('./updater.js');
const { createWindow, openViewer } = require('./window.js');
const { ensureTray, showMainWindow } = require('./tray.js');
const { makeLogger } = require('./logger.js');
const config = require('./config.js');

/* 查看器目录默认解析：开发期指向 desktop/viewer-dist；打包后由 resources 提供 */
function defaultViewerDir (d) {
  if (d.isPackaged) return path.join(d.resourcesPath || process.resourcesPath || '', 'viewer-dist');
  return path.join(__dirname, '..', 'viewer-dist');
}

/**
 * 启动应用。
 * @param {object} options 注入的原生依赖与配置（app / BrowserWindow / dialog / ipcMain /
 *   Menu / Tray / nativeImage / shell / protocol / net / autoUpdater / viewerDir / VERSION / ...）
 */
async function start (options) {
  const d = options || {};
  ctx.deps = d;
  ctx.VERSION = d.VERSION || (d.app && d.app.getVersion && d.app.getVersion()) || '0.0.0';
  ctx.PORTABLE = !!d.PORTABLE;
  ctx.RELEASES_URL = d.RELEASES_URL || 'https://github.com/xianyu21/ol-workbench/releases';
  ctx.PRELOAD = d.PRELOAD || path.join(__dirname, '..', 'preload.js');
  ctx.userDataPath = d.userDataPath || (d.app && d.app.getPath && d.app.getPath('userData')) || process.cwd();

  // 日志（默认 console，正式运行由 logger 落盘）
  ctx.log = d.log || makeLogger(ctx.userDataPath);

  // 配置单例路径 + 用户数据落盘目录
  config.initConfig(ctx.userDataPath);
  userStore.init(ctx.userDataPath);

  // P0-4：查看器目录单源，由主进程显式注入（缺失即抛）
  const viewerDir = d.viewerDir || defaultViewerDir(d);
  core.setViewerDir(viewerDir);

  const app = d.app;
  // 崩溃规避开关（必须在 app ready 之前）
  if (app && app.disableHardwareAcceleration) app.disableHardwareAcceleration();
  if (app && app.commandLine) {
    app.commandLine.appendSwitch('in-process-gpu');
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-crash-reporter');
    app.commandLine.appendSwitch('disable-crashpad');
  }

  ctx.log('app.start VERSION=', ctx.VERSION);
  ctx.log('__dirname=', __dirname);
  ctx.log('viewerDir=', viewerDir);

  // 单实例锁：避免多开
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) { app.quit(); return; }
  app.on('second-instance', () => showMainWindow());
  app.on('activate', () => { if (d.BrowserWindow.getAllWindows().length === 0) createWindow(); });
  // 更新安装/托盘退出走 app.quit() → before-quit 放行窗口 close，并把待写数据立即落盘
  app.on('before-quit', () => { ctx.quitting = true; userStore.flush(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

  await app.whenReady();

  // 注册特权协议处理 + IPC handler + 自动更新
  registerAxhubProtocol({ protocol: d.protocol, net: d.net });
  registerIpc(d.ipcMain, ctx);
  setupAutoUpdater({ autoUpdater: d.autoUpdater });

  // 启动期对账：pendingInstall 首启看门狗 / justRolledBack 派发（须在窗口可见前完成）
  onBootReconcile();

  // 打开主窗口并加载（记住的目录或空态工作台）
  const w = createWindow();
  ctx.win = w;
  // 首启异常判定之一：渲染进程崩溃（配合看门狗超时，双重保险）
  if (w.webContents && typeof w.webContents.on === 'function') {
    w.webContents.on('crashed', () => onWebContentsCrashed());
  }
  const savedDir = config.loadDir();
  ctx.savedDir = savedDir;
  if (savedDir && fs.existsSync(savedDir)) await openViewer(savedDir);
  else await openViewer(null);
}

module.exports = { start };
