'use strict';
/*
 * 桥的纯函数核心：把 ipcRenderer 适配成渲染层 window.axhub 接口。
 * 抽成「无 electron 依赖」的模块，便于 node --test 用 mock ipcRenderer 断言 17 方法映射。
 */
function buildBridge (ipcRenderer) {
  return {
    // 目录选择 / 清单
    selectDir: () => ipcRenderer.invoke('picker:select'),
    clearDir: () => ipcRenderer.invoke('dir:clear'),
    getTree: () => ipcRenderer.invoke('tree:get'),
    // API 文档文件（可多个）：多选添加 / 读取选中文件内容
    pickApiFiles: () => ipcRenderer.invoke('apidir:pickFiles'),
    readApiFiles: (files) => ipcRenderer.invoke('apidir:read', files),
    // 版本 / 更新
    version: () => ipcRenderer.invoke('app:version'),
    checkUpdate: () => ipcRenderer.invoke('update:check'),
    installUpdate: () => ipcRenderer.send('update:install'),
    setSilentUpdate: (on) => ipcRenderer.send('update:set-silent', on),
    onUpdateProgress: (cb) => { ipcRenderer.on('update:progress', (e, pct) => cb(pct)); },
    onUpdateAvailable: (cb) => { ipcRenderer.on('update:available', (e, info) => cb(info)); },
    onUpdateReady: (cb) => { ipcRenderer.on('update:ready', (e, info) => cb(info)); },
    // 关闭行为：主进程发起询问 → 页面弹 antd Modal → 回传选择
    onCloseActionRequest: (cb) => { ipcRenderer.on('close:ask', () => cb()); },
    applyCloseAction: (action, remember) => ipcRenderer.send('close:apply', action, remember),
    saveCloseAction: (action) => ipcRenderer.send('close:save', action),
    // 用户核心数据：渲染层变更后整包回传防抖落盘；清空（备份弹窗）
    saveUserData: (data) => ipcRenderer.send('user-data:save', data),
    clearUserData: () => ipcRenderer.send('user-data:clear')
  };
}

module.exports = { buildBridge };
