'use strict';
/*
 * IPC：版本号 / 手动检查更新 / 安装 / 静默下载开关 / 渠道 / 回滚 / 首启就绪 / 重试。
 * 新增 P0 生命周期事件统一经 update:event 多路复用（见 updater.js）。
 */
const updater = require('../updater.js');
const { FailureReason, describe, mapInstallError } = require('../update/errors.js');
const constants = require('../update/constants.js');

function register (ipcMain, c) {
  ipcMain.handle('app:version', () => c.VERSION);

  ipcMain.handle('update:check', async () => {
    const au = c.deps.autoUpdater;
    try {
      const r = await au.checkForUpdates();
      const info = r && r.updateInfo;
      if (!info) return { ok: false, error: '无法获取更新信息' };
      // 防重装循环：命中被封锁坏版本则视作无可用更新
      const st = c.config.getUpdateState();
      if (st.blockedVersion && info.version === st.blockedVersion) {
        return { ok: true, available: false, version: info.version, portable: c.PORTABLE, blocked: true };
      }
      return { ok: true, available: info.version !== c.VERSION, version: info.version, portable: c.PORTABLE };
    } catch (e) {
      c.log('manual check error:', e && e.message);
      return { ok: false, error: (e && e.message || String(e)).split('\n')[0].slice(0, 160) };
    }
  });

  /* 更新已后台下载完成 → 页面点「立即重启安装」时执行。
     先跑 preflight，通过才 quitAndInstall；不通过发 install-blocked 给渲染层拦截卡。 */
  ipcMain.on('update:install', () => {
    const pf = updater.runInstallPreflight();
    if (!pf.ok) {
      c.log('install preflight blocked:', pf.reason, pf.detail);
      const fd = describe(pf.reason, { detail: pf.detail });
      c.sendToWin('update:event', { type: 'install-blocked', payload: fd });
      return;
    }
    c.log('update:install, quitAndInstall');
    c.quitting = true; // 放行窗口 close，避免被关闭询问/托盘拦截
    try { c.deps.autoUpdater.quitAndInstall(false, true); }
    catch (e) {
      c.log('install error:', e && e.message);
      c.sendToWin('update:event', {
        type: 'install-failed',
        payload: describe(mapInstallError(e), { message: (e && e.message) || String(e) })
      });
    }
  });

  /* 设置页「后台静默下载」开关：落盘并即时生效 */
  ipcMain.on('update:set-silent', (e, on) => {
    const enabled = !!on;
    c.deps.autoUpdater.autoDownload = enabled;
    c.config.saveConfig({ silentUpdate: enabled });
    c.log('silent update:', enabled);
  });

  /* 新：查询当前更新状态（版本/渠道/lastKnownGood/portable） */
  ipcMain.handle('update:status', () => {
    const st = c.config.getUpdateState();
    return {
      version: c.VERSION,
      channel: st.channel || 'stable',
      lastKnownGood: st.lastKnownGoodVersion || c.VERSION,
      portable: c.PORTABLE
    };
  });

  /* 新：切换渠道 → 落 config → 设 autoUpdater.channel → 立即检查 */
  ipcMain.on('update:set-channel', (e, channel) => {
    if (!constants.isChannel(channel)) { c.log('invalid channel:', channel); return; }
    c.config.setUpdateState({ channel: channel });
    updater.applyChannel();
    c.log('set channel:', channel);
    try { c.deps.autoUpdater.checkForUpdates().catch(() => {}); } catch (err) { /* ignore */ }
    updater.pushStatus();
  });

  /* 新：渲染层 UI 就绪信号（首启对账用，App.vue onMounted 发一次） */
  ipcMain.on('update:first-launch-ready', () => {
    updater.markFirstLaunchReady();
  });

  /* 新：退避耗尽后手动重试下载 */
  ipcMain.on('update:download-retry-now', () => {
    c.log('manual download retry');
    updater.getDownloadRetry().retryNow();
  });

  /* 新：手动回滚（UI 已二次确认） */
  ipcMain.on('update:rollback', () => {
    c.log('manual rollback requested');
    updater.triggerManualRollback();
  });
}

module.exports = { register };
