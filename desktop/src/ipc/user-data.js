'use strict';
/*
 * IPC：用户核心数据磁盘持久化。
 * preload 启动时 sendSync 拉取一次（磁盘为事实来源；文件缺失返回 null，渲染层保留现有 localStorage）。
 */
const userStore = require('../../user-store.js');

function register (ipcMain, c) {
  ipcMain.on('user-data:load-sync', (e) => { e.returnValue = userStore.load(); });
  ipcMain.on('user-data:save', (e, data) => userStore.save(data));
  ipcMain.on('user-data:clear', () => userStore.clear());
}

module.exports = { register };
