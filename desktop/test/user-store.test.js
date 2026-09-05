'use strict';
// 用户数据磁盘存储模块测试（node:test，零依赖）
// 只断言外部行为：load/save/flush/clear 接口的落盘结果与容错，不窥探内部实现。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const userStore = require('../user-store.js');

function tmpDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wb-user-store-'));
}

test('init 后目录无文件时 load 返回 null（首次安装，渲染层保留 localStorage 自动迁移）', () => {
  const dir = tmpDir();
  userStore.init(dir);
  assert.strictEqual(userStore.load(), null);
  assert.strictEqual(fs.readdirSync(dir).length, 0);
});

test('save 防抖落盘：等待后 load 读回一致', async () => {
  const dir = tmpDir();
  userStore.init(dir);
  userStore.save({ wb_axhub_projects: [{ id: 'p1', fav: 1 }], wb_axhub_recent: ['p1'] });
  // 防抖窗口内文件尚未生成
  assert.strictEqual(fs.existsSync(path.join(dir, 'wb-user-data.json')), false);
  await new Promise(r => setTimeout(r, 600));
  const data = userStore.load();
  assert.deepStrictEqual(data, { wb_axhub_projects: [{ id: 'p1', fav: 1 }], wb_axhub_recent: ['p1'] });
});

test('防抖窗口内多次 save 合并为最后一次', async () => {
  const dir = tmpDir();
  userStore.init(dir);
  userStore.save({ a: 1 });
  userStore.save({ a: 2 });
  userStore.save({ a: 3 });
  await new Promise(r => setTimeout(r, 600));
  assert.deepStrictEqual(userStore.load(), { a: 3 });
});

test('flush 立即落盘（退出前调用），无需等防抖', () => {
  const dir = tmpDir();
  userStore.init(dir);
  userStore.save({ k: 'v' });
  userStore.flush();
  assert.deepStrictEqual(userStore.load(), { k: 'v' });
});

test('文件损坏时 load 返回 null 并留档 .corrupt，应用不崩', () => {
  const dir = tmpDir();
  userStore.init(dir);
  fs.writeFileSync(path.join(dir, 'wb-user-data.json'), '{ not valid json !!');
  assert.strictEqual(userStore.load(), null);
  assert.ok(fs.existsSync(path.join(dir, 'wb-user-data.json.corrupt')));
});

test('原子写：目录里不残留 .tmp 文件', async () => {
  const dir = tmpDir();
  userStore.init(dir);
  userStore.save({ k: 1 });
  await new Promise(r => setTimeout(r, 600));
  assert.deepStrictEqual(
    fs.readdirSync(dir).sort(),
    ['wb-user-data.json'],
    '轮转后目录应只包含数据文件本身'
  );
});

test('clear 移除数据文件并丢弃待写内容', async () => {
  const dir = tmpDir();
  userStore.init(dir);
  userStore.save({ keep: 1 });
  userStore.flush();
  userStore.clear();
  userStore.save({ dropped: 1 });
  userStore.clear();
  await new Promise(r => setTimeout(r, 600));
  assert.strictEqual(userStore.load(), null);
  assert.strictEqual(fs.readdirSync(dir).length, 0);
});

test('clear 后再次 save 恢复正常写入', async () => {
  const dir = tmpDir();
  userStore.init(dir);
  userStore.clear();
  userStore.save({ fresh: true });
  userStore.flush();
  assert.deepStrictEqual(userStore.load(), { fresh: true });
});

test('save 忽略非对象入参', () => {
  const dir = tmpDir();
  userStore.init(dir);
  userStore.save(null);
  userStore.save('str');
  userStore.flush();
  assert.strictEqual(userStore.load(), null);
});
