'use strict';
/*
 * 在线更新（electron-updater）：后台静默下载为默认行为，下载完成后提示可立即重启；
 * 便携版不支持自动更新，仅给下载指引。全部经 context 取依赖，不 require electron。
 */
const ctx = require('./context.js');

/**
 * 装配自动更新。
 * @param {{autoUpdater: object}} deps
 */
function setupAutoUpdater ({ autoUpdater }) {
  const { log, VERSION, PORTABLE, RELEASES_URL, deps } = ctx;
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };
  autoUpdater.autoDownload = ctx.config.loadConfig().silentUpdate !== false; // 后台静默下载（默认开启）
  autoUpdater.autoInstallOnAppQuit = true;                                 // 已下载的更新在退出应用时自动安装

  let downloading = false;

  autoUpdater.on('update-available', async (info) => {
    log('update available:', info && info.version, PORTABLE ? '(portable)' : '');
    if (!ctx.win) return;
    // GitHub Release 的 body 即更新内容；可能是 markdown/html，去标签后展示
    let notes = info && (info.releaseNotes || '');
    if (typeof notes === 'object' && notes) notes = notes.content || ''; // html 形态 {content}
    notes = String(notes).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    if (PORTABLE) {
      // portable 版无法自动更新，给明确指引而不是下载询问
      const r = await deps.dialog.showMessageBox(ctx.win, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 v${info.version}（当前 v${VERSION}）。`,
        detail: (notes ? `更新内容：\n\n${notes}\n\n` : '') + '便携版不支持自动更新，请到 Releases 页面重新下载。',
        buttons: ['打开 Releases 页面', '以后再说'], defaultId: 0, cancelId: 1
      });
      if (r.response === 0) deps.shell.openExternal(RELEASES_URL).catch(() => {});
      return;
    }
    if (autoUpdater.autoDownload) {
      // 静默分支：后台直接下载，页面角落显示进度，不弹窗、不改窗口标题
      if (downloading) return;
      downloading = true;
      ctx.sendToWin('update:available', { version: info.version });
      try {
        await autoUpdater.downloadUpdate(); // 完成后由 update-downloaded 事件接管
      } catch (e) {
        downloading = false;
        log('silent download error:', e && e.message);
        ctx.sendToWin('update:progress', null);
      }
      return;
    }
    // 非静默分支（设置里关掉「后台静默下载」）：下载前询问
    const detail = notes ? `更新内容：\n\n${notes}\n\n` : '';
    const r = await deps.dialog.showMessageBox(ctx.win, {
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
      if (ctx.win) deps.dialog.showErrorBox('更新失败', '下载更新失败：\n' + (e && e.message || e));
    }
  });

  autoUpdater.on('download-progress', (p) => {
    if (!ctx.win || !p || p.percent == null) return;
    // 静默模式不改窗口标题（避免打扰），仅在页面角落显示进度
    if (!autoUpdater.autoDownload) ctx.win.setTitle(`AxHub 原型工作台 · 正在下载更新 ${Math.round(p.percent)}%`);
    ctx.sendToWin('update:progress', Math.round(p.percent));
  });

  autoUpdater.on('update-downloaded', (info) => {
    downloading = false;
    if (ctx.win) ctx.win.setTitle('AxHub 原型工作台');
    log('update downloaded:', info && info.version, '（退出应用时自动安装）');
    // 不强制重启（避免打断正在进行的浏览）：提示可立即重启，未操作则退出应用时自动安装
    ctx.sendToWin('update:progress', null);
    ctx.sendToWin('update:ready', { version: (info && info.version) || '' });
  });

  autoUpdater.on('error', (e) => {
    downloading = false;
    if (ctx.win) ctx.win.setTitle('AxHub 原型工作台');
    ctx.sendToWin('update:progress', null);
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

module.exports = { setupAutoUpdater };
