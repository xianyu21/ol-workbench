'use strict';
/*
 * IPC：版本号 / 手动检查更新 / 安装 / 静默下载开关。
 */
function register (ipcMain, c) {
  ipcMain.handle('app:version', () => c.VERSION);

  ipcMain.handle('update:check', async () => {
    const au = c.deps.autoUpdater;
    try {
      const r = await au.checkForUpdates();
      const info = r && r.updateInfo;
      if (!info) return { ok: false, error: '无法获取更新信息' };
      // 有新版本时 update-available 事件会弹窗展示更新内容并询问下载
      return { ok: true, available: info.version !== c.VERSION, version: info.version, portable: c.PORTABLE };
    } catch (e) {
      c.log('manual check error:', e && e.message);
      return { ok: false, error: (e && e.message || String(e)).split('\n')[0].slice(0, 160) };
    }
  });

  // 更新已后台下载完成 → 页面点「立即重启安装」时执行（未点则退出应用时自动安装）
  ipcMain.on('update:install', () => {
    c.log('update:install, quitAndInstall');
    c.quitting = true; // 放行窗口 close，避免被关闭询问/托盘拦截
    try { c.deps.autoUpdater.quitAndInstall(false, true); } catch (e) { c.log('install error:', e && e.message); }
  });

  // 设置页「后台静默下载」开关：落盘并即时生效（关闭则回到下载前询问）
  ipcMain.on('update:set-silent', (e, on) => {
    const enabled = !!on;
    c.deps.autoUpdater.autoDownload = enabled;
    c.config.saveConfig({ silentUpdate: enabled });
    c.log('silent update:', enabled);
  });
}

module.exports = { register };
