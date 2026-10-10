'use strict';
/*
 * IPC：API 文档文件（可多个，供 API 视图「从文件导入」）。
 * 文件读取改 fs.promises（P0-3）：消除同步阻塞。
 */
const fs = require('fs');

function register (ipcMain, c) {
  // 多选添加 .md 文件 → 渲染层自行去重登记（持久化 key: apiFiles）
  ipcMain.handle('apidir:pickFiles', async () => {
    const r = await c.deps.dialog.showOpenDialog(c.win, {
      title: '添加接口文档文件',
      message: '选择 Apifox / Apipost 导出的 Markdown 文件（可按住 Ctrl 多选）',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    });
    if (r.canceled || !r.filePaths.length) return [];
    return r.filePaths;
  });

  // 读取选中的 .md 文件内容（单文件上限 8MB，超大拒绝并标记 error）
  ipcMain.handle('apidir:read', async (e, files) => {
    return Promise.all((files || []).map(async (f) => {
      try {
        const st = await fs.promises.stat(f.path);
        if (!st.isFile()) return { ...f, text: '', error: 'not-a-file' };
        if (st.size > 8 * 1024 * 1024) return { ...f, text: '', error: 'too-large' };
        return { name: f.name, path: f.path, size: st.size, text: await fs.promises.readFile(f.path, 'utf8') };
      } catch (err) {
        return { name: f.name, path: f.path, size: 0, text: '', error: String(err && err.message || err).slice(0, 120) };
      }
    }));
  });
}

module.exports = { register };
