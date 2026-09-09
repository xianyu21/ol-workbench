'use strict';
// library.js（收藏库合并纯函数）单元测试（node:test，零依赖，动态 import ESM）
// 覆盖备份导入合并与扫描清单合并的规则边界——这些规则曾锁死在组件里无法测试。
const test = require('node:test');
const assert = require('node:assert');

const L = () => import('../viewer/src/library.js');
let lib;

test.before(async () => { lib = await L(); });

const page = (id, extra) => Object.assign({ id, path: id + '.html', name: id, tags: [], fav: 0, openCount: 0, lastOpen: 0, renamed: 0, cover: null, addedAt: 1 }, extra);

test('mergeProjects：新增追加尾部、更新取并集/较大值', async () => {
  const cur = [
    page('a', { tags: ['高频'], fav: 1, openCount: 3, lastOpen: 100 }),
    page('b')
  ];
  const inc = [
    page('a', { tags: ['待评审', '高频'], openCount: 5, lastOpen: 200, renamed: 1, name: '改名' }),
    page('c', { fav: 1 })
  ];
  const r = lib.mergeProjects(cur, inc);
  assert.strictEqual(r.add, 1);
  assert.strictEqual(r.updated, 1);
  assert.deepStrictEqual(r.projects.map(p => p.id), ['a', 'b', 'c'], '新增追加尾部');
  const a = r.projects[0];
  assert.deepStrictEqual(a.tags.sort(), ['待评审', '高频'], '标签并集去重');
  assert.strictEqual(a.openCount, 5, '计数取大');
  assert.strictEqual(a.lastOpen, 200, '时间取大');
  assert.strictEqual(a.fav, 1, '收藏取或');
  assert.strictEqual(a.name, '改名', '重命名优先');
  assert.strictEqual(cur[0].openCount, 3, '入参不可变');
});

test('mergeProjects：未重命名时保留本地名；cover 只补缺', async () => {
  const cur = [page('a', { name: '本地名', renamed: 1, cover: 'old.png' })];
  const r = lib.mergeProjects(cur, [page('a', { name: '备份名', renamed: 1, cover: 'new.png' })]);
  assert.strictEqual(r.projects[0].name, '备份名', '对方重命名过则采纳');
  const r2 = lib.mergeProjects(cur, [page('a', { name: '备份名' })]);
  assert.strictEqual(r2.projects[0].name, '本地名', '对方未重命名保留本地名');
  const r3 = lib.mergeProjects([page('a')], [page('a', { cover: 'new.png' })]);
  assert.strictEqual(r3.projects[0].cover, 'new.png', '本地缺 cover 才补');
});

test('mergeTags：按 name 去重，保留既有颜色', async () => {
  const cur = [{ name: '高频', color: '#111' }];
  const out = lib.mergeTags(cur, [{ name: '高频', color: '#222' }, { name: '新增', color: '#333' }]);
  assert.deepStrictEqual(out, [{ name: '高频', color: '#111' }, { name: '新增', color: '#333' }]);
});

test('mergeScannedPages：清单重建 + 本地标注按路径保留 + addedAt 注入', async () => {
  const cur = [page('a', { path: 'a.html', fav: 1, renamed: 1, name: '本地名', addedAt: 42 })];
  const pages = [
    { id: 'a', path: 'a.html', name: '扫描名', group: 'g', size: 10 },
    { id: 'b', path: 'b.html', name: 'b', group: 'g', size: 20 }
  ];
  const r = lib.mergeScannedPages(cur, pages, 999);
  assert.strictEqual(r.projects[0].fav, 1);
  assert.strictEqual(r.projects[0].name, '本地名');
  assert.strictEqual(r.projects[0].addedAt, 42, '已存在的 addedAt 不动');
  assert.strictEqual(r.projects[1].addedAt, 999, '新页面 addedAt 由 now 注入');
  assert.deepStrictEqual(r.projects.map(p => p.id), ['a', 'b'], '顺序跟随扫描结果（含已删除页面的移除）');
});
