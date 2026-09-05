'use strict';
// 启动屏/工作台与主进程的桥：目录选择、版本/更新、关闭行为，不暴露 Node。
const { contextBridge, ipcRenderer } = require('electron');

// ---------- 用户核心数据：磁盘为事实来源，localStorage 为同源缓存 ----------
// 预加载阶段同步拉取磁盘快照灌入 localStorage（此时渲染层脚本尚未运行，
// store.js 等模块初始化读到的即是磁盘数据）。磁盘无数据（首次安装/损坏清退）
// 时不写入 → 保留现有 localStorage，旧版本数据经首次保存自动迁移落盘。
try {
  const disk = ipcRenderer.sendSync('user-data:load-sync');
  if (disk && typeof disk === 'object') {
    Object.keys(localStorage).slice().forEach(k => {
      if (k.indexOf('wb_axhub_') === 0) localStorage.removeItem(k);
    });
    Object.keys(disk).forEach(k => {
      try { localStorage.setItem(k, JSON.stringify(disk[k])); } catch (e) { /* 单键失败不阻断 */ }
    });
  }
} catch (e) { /* 主进程未就绪等异常：退回纯 localStorage 行为 */ }

contextBridge.exposeInMainWorld('axhub', {
  selectDir: () => ipcRenderer.invoke('picker:select'),
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  // 关闭行为：主进程发起询问 → 页面弹 antd Modal → 回传选择
  onCloseActionRequest: (cb) => { ipcRenderer.on('close:ask', () => cb()); },
  applyCloseAction: (action, remember) => ipcRenderer.send('close:apply', action, remember),
  saveCloseAction: (action) => ipcRenderer.send('close:save', action),
  // 用户核心数据：渲染层变更后整包回传防抖落盘；清空（备份弹窗）
  saveUserData: (data) => ipcRenderer.send('user-data:save', data),
  clearUserData: () => ipcRenderer.send('user-data:clear'),
  // 更新下载进度：主进程 download-progress → 页面内进度提示（null = 结束/失败）
  onUpdateProgress: (cb) => { ipcRenderer.on('update:progress', (e, pct) => cb(pct)); }
});
