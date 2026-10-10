'use strict';
/*
 * IPC：工作区（目录选择 / 清单读取 / 目录解绑）。
 * 所有 handler 经 c（context）取依赖，便于用 mock ipcMain + mock context 注入测试。
 */
const core = require('../../serve-core.js');

function register (ipcMain, c) {
  // 启动屏选择目录
  ipcMain.handle('picker:select', async () => {
    const r = await c.deps.dialog.showOpenDialog(c.win, {
      title: '选择 AxHub 导出目录',
      message: '请选择包含 index.html 与多个 .html 页面的 AxHub / Axure 导出文件夹',
      properties: ['openDirectory']
    });
    if (r.canceled || !r.filePaths.length) return null;
    const { openViewer } = require('../window.js');
    await openViewer(r.filePaths[0]);
    return r.filePaths[0];
  });

  // 移除目录（只解绑 + 清配置，重载空态工作台；磁盘文件不动）
  ipcMain.handle('dir:clear', async () => {
    c.log('dir:clear');
    const { openViewer } = require('../window.js');
    try { await openViewer(null); } catch (e) { c.log('dir:clear reload error:', e && e.message); }
    return true;
  });

  // 页面清单（协议层不可被本机其他进程访问，清单只经 IPC 给渲染层）
  ipcMain.handle('tree:get', () => {
    const root = core.getRoot();
    if (!root) return { name: '', root: null, entry: null, hasData: false, pages: [] };
    return core.scanAxHub(root); // 异步：返回 Promise，ipcMain.handle 会自动 await
  });
}

module.exports = { register };
