'use strict';
/*
 * IPC 注册聚合器（可注入式）。
 * @param {object} ipcMain 兼容性对象（真实 electron ipcMain 或测试 mock）
 * @param {object} c 共享上下文（默认取 ./context 单例）
 * 各子模块统一经 c 取依赖，故可直接传入 mock 上下文做单元/烟雾测试。
 */
const ctx = require('../context.js');
const workspace = require('./workspace.js');
const userData = require('./user-data.js');
const apidocs = require('./apidocs.js');
const update = require('./update.js');
const close = require('./close.js');

function registerIpc (ipcMain, c) {
  const C = c || ctx;
  workspace.register(ipcMain, C);
  userData.register(ipcMain, C);
  apidocs.register(ipcMain, C);
  update.register(ipcMain, C);
  close.register(ipcMain, C);
}

module.exports = { registerIpc };
