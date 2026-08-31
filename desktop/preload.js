'use strict';
// 启动屏（picker.html）与主进程的桥：仅暴露选择目录能力，不暴露 Node。
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('axhub', {
  selectDir: () => ipcRenderer.invoke('picker:select')
});
