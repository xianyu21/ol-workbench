'use strict';
// 启动屏/工作台与主进程的桥：目录选择、版本/更新、关闭行为，不暴露 Node。
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('axhub', {
  selectDir: () => ipcRenderer.invoke('picker:select'),
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  // 关闭行为：主进程发起询问 → 页面弹 antd Modal → 回传选择
  onCloseActionRequest: (cb) => { ipcRenderer.on('close:ask', () => cb()); },
  applyCloseAction: (action, remember) => ipcRenderer.send('close:apply', action, remember),
  saveCloseAction: (action) => ipcRenderer.send('close:save', action)
});
