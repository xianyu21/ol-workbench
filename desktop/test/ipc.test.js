'use strict';
/*
 * IPC 注册（可注入式）单测：用 mock ipcMain + mock context 注入，
 * 断言 registerIpc 把预期 channel 全部注册，并验证单个 handler 的逻辑。
 * 运行：cd desktop && node --test test/ipc.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const { registerIpc } = require('../src/ipc/index.js');
const ctx = require('../src/context.js');
const core = require('../serve-core.js');

/* mock ipcMain：分别记录 handle / on 的注册 */
function mockIpcMain () {
  const handles = {};
  const ons = {};
  return {
    handle: (ch, fn) => { handles[ch] = fn; },
    on: (ch, fn) => { (ons[ch] = ons[ch] || []).push(fn); },
    handles, ons
  };
}

test('registerIpc：注册全部预期 channel', () => {
  const ipc = mockIpcMain();
  registerIpc(ipc, ctx);
  const handleChannels = ['picker:select', 'dir:clear', 'tree:get', 'apidir:pickFiles', 'apidir:read', 'app:version', 'update:check'];
  for (const ch of handleChannels) assert.ok(ipc.handles[ch], 'handle 未注册: ' + ch);
  const onChannels = ['user-data:load-sync', 'user-data:save', 'user-data:clear', 'update:install', 'update:set-silent', 'close:apply', 'close:save'];
  for (const ch of onChannels) assert.ok(ipc.ons[ch] && ipc.ons[ch].length, 'on 未注册: ' + ch);
});

test('IPC tree:get：root 未设时返回空态结构（与渲染层空态一致）', async () => {
  const ipc = mockIpcMain();
  core.setRoot(null);
  registerIpc(ipc, ctx);
  const r = await ipc.handles['tree:get']();
  assert.deepStrictEqual(r, { name: '', root: null, entry: null, hasData: false, pages: [] });
});

test('IPC app:version：返回注入的版本号', async () => {
  const ipc = mockIpcMain();
  ctx.VERSION = '1.2.0';
  registerIpc(ipc, ctx);
  assert.strictEqual(await ipc.handles['app:version'](), '1.2.0');
});

test('IPC user-data:load-sync：把 userStore.load() 写入 e.returnValue（未 init 时为 null）', () => {
  const ipc = mockIpcMain();
  registerIpc(ipc, ctx);
  const e = {};
  ipc.ons['user-data:load-sync'][0](e);
  assert.strictEqual(e.returnValue, null);
});

test('IPC update:set-silent：写入配置并即时切换 autoDownload', () => {
  const ipc = mockIpcMain();
  const autoUpdater = { autoDownload: true };
  ctx.deps = { autoUpdater };
  ctx.config.saveConfig({ silentUpdate: true });
  registerIpc(ipc, ctx);
  const e = {};
  ipc.ons['update:set-silent'][0](e, false);
  assert.strictEqual(autoUpdater.autoDownload, false);
});
