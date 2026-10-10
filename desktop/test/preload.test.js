'use strict';
/*
 * preload 桥（buildBridge 纯函数）单测：用 mock ipcRenderer 验证 17 个方法
 * 一致映射到正确 channel。运行：cd desktop && node --test test/preload.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const { buildBridge } = require('../src/preload-bridge.js');

/* mock ipcRenderer：记录 invoke / send / on 调用 */
function mockIpcRenderer () {
  const calls = { invoke: [], send: [], on: [] };
  return {
    invoke: (ch, ...args) => { calls.invoke.push({ ch, args }); return Promise.resolve(); },
    send: (ch, ...args) => { calls.send.push({ ch, args }); },
    on: (ch, cb) => { calls.on.push({ ch, cb }); },
    calls
  };
}

test('buildBridge：17 个方法一致映射到正确 channel', () => {
  const ipc = mockIpcRenderer();
  const b = buildBridge(ipc);

  b.selectDir();
  b.clearDir();
  b.getTree();
  b.version();
  b.checkUpdate();
  assert.strictEqual(ipc.calls.invoke[0].ch, 'picker:select');
  assert.strictEqual(ipc.calls.invoke[1].ch, 'dir:clear');
  assert.strictEqual(ipc.calls.invoke[2].ch, 'tree:get');
  assert.strictEqual(ipc.calls.invoke[3].ch, 'app:version');
  assert.strictEqual(ipc.calls.invoke[4].ch, 'update:check');

  b.pickApiFiles();
  b.readApiFiles([{ name: 'a.md' }]);
  assert.strictEqual(ipc.calls.invoke[5].ch, 'apidir:pickFiles');
  assert.strictEqual(ipc.calls.invoke[6].ch, 'apidir:read');
  assert.deepStrictEqual(ipc.calls.invoke[6].args, [[{ name: 'a.md' }]]);

  b.installUpdate();
  b.setSilentUpdate(true);
  assert.strictEqual(ipc.calls.send[0].ch, 'update:install');
  assert.strictEqual(ipc.calls.send[1].ch, 'update:set-silent');
  assert.strictEqual(ipc.calls.send[1].args[0], true);

  b.applyCloseAction('background', true);
  b.saveCloseAction('exit');
  b.saveUserData({ k: 1 });
  b.clearUserData();
  assert.strictEqual(ipc.calls.send[2].ch, 'close:apply');
  assert.deepStrictEqual(ipc.calls.send[2].args, ['background', true]);
  assert.strictEqual(ipc.calls.send[3].ch, 'close:save');
  assert.strictEqual(ipc.calls.send[4].ch, 'user-data:save');
  assert.strictEqual(ipc.calls.send[5].ch, 'user-data:clear');

  // 订阅型：注册到对应 channel，且回调可被触发
  let fired = null;
  b.onUpdateProgress((pct) => { fired = pct; });
  b.onUpdateAvailable((info) => { fired = info; });
  b.onUpdateReady((info) => { fired = info; });
  b.onCloseActionRequest(() => { fired = 'ask'; });
  assert.strictEqual(ipc.calls.on[0].ch, 'update:progress');
  assert.strictEqual(ipc.calls.on[1].ch, 'update:available');
  assert.strictEqual(ipc.calls.on[2].ch, 'update:ready');
  assert.strictEqual(ipc.calls.on[3].ch, 'close:ask');
  ipc.calls.on[3].cb();
  assert.strictEqual(fired, 'ask');
});

test('buildBridge：返回对象恰含 17 个方法', () => {
  const ipc = mockIpcRenderer();
  const keys = Object.keys(buildBridge(ipc)).sort();
  assert.strictEqual(keys.length, 17, '方法数应为 17，实际: ' + keys.length);
});
