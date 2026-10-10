'use strict';
/*
 * P0-4 补强边界测试：serve-core 的 viewerDir 注入式单源守门
 * - setViewerDir(dir) 在 dir 缺失（null / '' / undefined）时必须抛错，禁止任何 fallback 探测
 * - getViewerDir() 在注入前必须抛错（而不是返回 undefined / 静默回退到某个默认路径）
 * - 注入后 getViewerDir() 返回 path.resolve 后的绝对路径
 *
 * 用「清缓存后重新 require」拿到独立模块实例，隔离 serve-core 模块级的 VIEWER_DIR 状态，
 * 避免与 serve-core.test.js 顶部已注入的实例互相污染。
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

function freshCore () {
  delete require.cache[require.resolve('../serve-core.js')];
  return require('../serve-core.js');
}

test('P0-4 守门：setViewerDir 缺失 dir 即抛（null / 空串 / undefined）', () => {
  const core = freshCore();
  assert.throws(() => core.setViewerDir(null), /未注入/);
  assert.throws(() => core.setViewerDir(''), /未注入/);
  assert.throws(() => core.setViewerDir(undefined), /未注入/);
});

test('P0-4 守门：getViewerDir 注入前必须抛，注入后返回解析后的绝对路径', () => {
  const core = freshCore();
  // 注入前：禁止 fallback 探测，必须抛
  assert.throws(() => core.getViewerDir(), /未注入/);
  // 注入后：返回 path.resolve 后的绝对路径，且等于预期
  const want = path.join(__dirname, '..', 'viewer-dist');
  core.setViewerDir(want);
  assert.strictEqual(core.getViewerDir(), path.resolve(want));
});
