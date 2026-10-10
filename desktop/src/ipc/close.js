'use strict';
/*
 * IPC：关闭行为（页面弹窗回传选择 / 设置页保存偏好）。
 * 主进程发起询问由 window.handleClose 经 webContents.send('close:ask') 触发，
 * 渲染层订阅 onCloseActionRequest 弹窗，再经 close:apply / close:save 回传。
 */
function register (ipcMain, c) {
  ipcMain.on('close:apply', (e, action, remember) => {
    const w = c.deps.BrowserWindow.fromWebContents(e.sender);
    if (!w) return;
    if (remember) c.config.saveConfig({ closeAction: action });
    if (action === 'background') { w.hide(); require('../tray.js').ensureTray(); }
    else { c.quitting = true; c.deps.app.quit(); }
  });

  // 设置页改关闭行为：仅保存，不触发动作（'' = 每次询问）
  ipcMain.on('close:save', (e, action) => c.config.saveConfig({ closeAction: action || '' }));
}

module.exports = { register };
