'use strict';
/*
 * api-docs 模块库 CRUD 单测
 * 运行：cd desktop && node --test test/api-docs.test.js
 */
const test = require('node:test');
const assert = require('node:assert');

let M;
test.before(async () => { M = await import('../viewer/src/lib/api-docs.js'); });

test('新增模块：id 自增、字段齐全、不改动入参', () => {
  const d0 = M.emptyDocs();
  const r = M.addModule(d0, { name: '用户管理', fileName: '用户管理.md', size: 100, md: '# 用户管理' });
  assert.strictEqual(r.id, 'm1');
  assert.strictEqual(r.docs.modules.length, 1);
  assert.strictEqual(r.docs.modules[0].name, '用户管理');
  assert.strictEqual(r.docs.modules[0].rev, 1);
  assert.strictEqual(r.docs.seq, 2);
  assert.strictEqual(d0.modules.length, 0, '入参不可被修改');
  const r2 = M.addModule(r.docs, { name: '订单', md: '' });
  assert.strictEqual(r2.id, 'm2');
});

test('批量导入：每个文件一个模块', () => {
  const r = M.bulkAddFromFiles(M.emptyDocs(), [
    { name: 'A', size: 1, text: '# A' },
    { name: 'B', size: 2, text: '# B' }
  ], 1000);
  assert.strictEqual(r.docs.modules.length, 2);
  assert.deepStrictEqual(r.ids, ['m1', 'm2']);
  assert.strictEqual(r.docs.modules[0].importedAt, 1000);
});

test('重命名 / 删除', () => {
  let d = M.bulkAddFromFiles(M.emptyDocs(), [{ name: 'A', text: '' }, { name: 'B', text: '' }]).docs;
  d = M.renameModule(d, 'm1', '用户中心');
  assert.strictEqual(M.moduleOf(d, 'm1').name, '用户中心');
  d = M.renameModule(d, 'm1', '   ');
  assert.strictEqual(M.moduleOf(d, 'm1').name, '用户中心', '空名不生效');
  d = M.removeModule(d, 'm1');
  assert.strictEqual(d.modules.length, 1);
  assert.strictEqual(M.moduleOf(d, 'm1'), null);
});

test('重新导入覆盖 / 追加导入：rev 递增且保留自定义名称', () => {
  let d = M.addModule(M.emptyDocs(), { name: '原名', md: 'A' }).docs;
  d = M.renameModule(d, 'm1', '我改过的名字');
  d = M.replaceModuleMd(d, 'm1', 'B', '新文件.md', 9, 123);
  const m = M.moduleOf(d, 'm1');
  assert.strictEqual(m.md, 'B');
  assert.strictEqual(m.name, '我改过的名字', '覆盖导入不改名');
  assert.strictEqual(m.rev, 2);
  assert.strictEqual(m.fileName, '新文件.md');
  d = M.appendModuleMd(d, 'm1', 'C', 456);
  assert.strictEqual(M.moduleOf(d, 'm1').md, 'B\n\nC');
  assert.strictEqual(M.moduleOf(d, 'm1').rev, 3);
});

test('备份合并：按 id 去重取新，seq 不与现有 id 冲突', () => {
  const cur = M.bulkAddFromFiles(M.emptyDocs(), [{ name: 'A', text: 'old' }]).docs;
  const backup = { seq: 1, modules: [{ id: 'm1', name: 'A', md: 'new', rev: 4 }, { id: 'm5', name: 'E', md: 'e', rev: 1 }] };
  const d = M.mergeApiDocs(cur, backup);
  assert.strictEqual(d.modules.length, 2);
  assert.strictEqual(M.moduleOf(d, 'm1').md, 'new', '备份内容优先');
  assert.strictEqual(M.moduleOf(d, 'm5').name, 'E');
  assert.ok(d.seq > 5, 'seq 必须超过现有最大 id 序号');
  const r = M.addModule(d, { name: '新模块', md: '' });
  assert.notStrictEqual(r.id, 'm5');
});
