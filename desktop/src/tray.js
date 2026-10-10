'use strict';
/*
 * 系统托盘（后台运行）：双击/菜单「打开工作台」恢复窗口；「退出」真正退出。
 */
const fs = require('fs');
const path = require('path');
const ctx = require('./context.js');

function trayIconPath () {
  const dev = path.join(__dirname, '..', 'build', 'icon.ico');
  if (fs.existsSync(dev)) return dev;
  return path.join(ctx.deps.resourcesPath || process.resourcesPath || '', 'build', 'icon.ico');
}

function ensureTray () {
  if (ctx.tray) return ctx.tray;
  try {
    const { Tray, Menu, nativeImage } = ctx.deps;
    const img = nativeImage.createFromPath(trayIconPath());
    const tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip('AxHub 原型工作台（后台运行中）');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开工作台', click: () => showMainWindow() },
      { type: 'separator' },
      { label: '退出', click: () => { ctx.quitting = true; ctx.deps.app.quit(); } }
    ]));
    tray.on('double-click', () => showMainWindow());
    ctx.tray = tray;
    return tray;
  } catch (e) { ctx.log('tray create error:', e && e.message); return null; }
}

function showMainWindow () {
  if (!ctx.win) { require('./window.js').openViewer(ctx.savedDir); return; }
  if (ctx.win.isMinimized()) ctx.win.restore();
  ctx.win.show();
  ctx.win.focus();
}

module.exports = { ensureTray, trayIconPath, showMainWindow };
