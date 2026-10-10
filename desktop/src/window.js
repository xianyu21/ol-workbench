'use strict';
/*
 * 窗口管理：创建 / 打开工作台 / 显示主窗口 / 关闭行为。
 * 共享状态（win / savedDir / quitting）来自 context，避免跨模块全局变量。
 */
const ctx = require('./context.js');
const core = require('../serve-core.js');
const { ensureTray, showMainWindow } = require('./tray.js');

function createWindow () {
  const { BrowserWindow, PRELOAD } = ctx.deps;
  const preload = PRELOAD || ctx.PRELOAD;
  const w = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    backgroundColor: '#f4efe6',
    show: false,
    title: 'AxHub 原型工作台',
    // webSecurity 保持默认开启：工作台与原型页同在 axhub://local 一个 origin 下，无需关闭。
    // sandbox:false：preload 需 require 本地模块（user-keys.js / user-store 桥）。
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  w.once('ready-to-show', () => w.show());
  w.on('close', (e) => handleClose(w, e));
  w.on('closed', () => { ctx.win = null; });
  return w;
}

/* 打开/切换工作台：注入根目录 → 扫描校验 → 加载 axhub://local/_axviewer/ */
async function openViewer (d) {
  const w = ctx.win || createWindow();
  ctx.win = w;
  ctx.savedDir = d;
  ctx.config.saveDir(d);

  // serve-core 挂上当前导出目录，并先做一次可读性校验（代替旧 HTTP 预检）
  core.setRoot(d);
  if (d) {
    const scan = await core.scanAxHub(d);
    if (scan.error) {
      ctx.log('openViewer: scan error:', scan.error);
      ctx.deps.dialog.showErrorBox('无法读取 AxHub 导出目录', scan.error + '\n\n目录：\n' + d + '\n\n日志路径：\n' + ctx.userDataPath + '/axhub-main.log');
      return;
    }
    ctx.log('scan ok, pages =', scan.pages.length);
  } else {
    ctx.log('no dir: open empty workspace');
  }

  // 强制当前窗口 session 直连，不经过系统代理/VPN（页面内的外链资源也保持直连）
  try { await w.webContents.session.setProxy({ proxyRules: 'direct://' }); } catch (e) { ctx.log('setProxy error:', e && e.message); }

  // 固定 origin（AXHUB_ORIGIN 与端口彻底解耦），localhost 拦截/端口漂移类问题不复存在
  const target = 'axhub://local/_axviewer/';
  try {
    ctx.log('loadURL', target);
    await w.loadURL(target);
    ctx.log('loadURL success');
    ctx.deps.Menu.setApplicationMenu(null); // 移除默认应用菜单栏
  } catch (e) {
    ctx.log('loadURL failed:', e && e.message, e && e.stack);
    ctx.deps.dialog.showErrorBox('无法打开工作台', (e && e.message || String(e)) + '\n\n日志路径：\n' + ctx.userDataPath + '/axhub-main.log');
  }
}

/* 关闭行为：询问后台运行还是直接退出，可记住选择 */
function handleClose (w, e) {
  if (ctx.quitting) return; // 放行真正退出
  const action = ctx.config.loadConfig().closeAction; // 'background' | 'exit' | undefined(每次问)
  if (action === 'background') { e.preventDefault(); w.hide(); ensureTray(); return; }
  if (action === 'exit') return; // 直接退出
  e.preventDefault();
  if (w.webContents && !w.webContents.isDestroyed() && !w.webContents.isLoading()) {
    w.webContents.send('close:ask');
  } else {
    nativeAskClose(w);
  }
}

function nativeAskClose (w) {
  ctx.deps.dialog.showMessageBox(w, {
    type: 'question', title: '关闭 AxHub 原型工作台',
    message: '要在后台继续运行，还是直接退出？',
    detail: '后台运行将最小化到系统托盘，可随时从托盘重新打开。',
    buttons: ['后台运行', '直接退出', '取消'], defaultId: 0, cancelId: 2
  }).then(r => {
    if (r.response === 2) return;
    if (r.response === 0) { w.hide(); ensureTray(); } else { ctx.quitting = true; ctx.deps.app.quit(); }
  });
}

module.exports = { createWindow, openViewer, showMainWindow, handleClose };
