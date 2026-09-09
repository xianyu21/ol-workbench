'use strict';
// tabs.js（标签页生命周期纯函数 module）单元测试（node:test，零依赖，动态 import ESM）
// invariant「激活标签永不休眠」由构造保证——这里逐条钉住。
const test = require('node:test');
const assert = require('node:assert');

const T = () => import('../viewer/src/tabs.js');
let tabs;

test.before(async () => { tabs = await T(); });

const mk = (id, extra) => Object.assign({ id, pid: 'p' + id, pinned: false, title: 't' + id, native: false, sleep: false, loading: false }, extra);
const model = (t, active, seq) => ({ tabs: t, active: active === undefined ? t[0].id : active, tabSeq: seq || { n: 1 } });
const PAGE = id => ({ id, name: '页面' + id, native: false });

test('open：已有标签激活而不新建；休眠的激活时唤醒', async () => {
  const t1 = mk('t1');
  const t2 = mk('t2', { sleep: true, loading: false });
  const r = tabs.open(model([t1, t2], 't1'), PAGE('pt2'));
  assert.strictEqual(r.tabs.length, 2);
  assert.strictEqual(r.active, 't2');
  const woken = r.tabs.find(x => x.id === 't2');
  assert.strictEqual(woken.sleep, false);
  assert.strictEqual(woken.loading, true, '唤醒时应置 loading 重建 iframe');
  assert.strictEqual(r.tabs.find(x => x.id === 't1'), t1, '未变更标签保持引用');
});

test('open：复用未固定的当前标签（浏览器式替换：换 pid/标题、清 src 快照）', async () => {
  const cur = mk('t1', { pid: 'pold', src: '/old.html' });
  const m = model([cur]);
  const r2 = tabs.open(m, PAGE('pnew'));
  assert.strictEqual(r2.active, 't1');
  const replaced = r2.tabs[0];
  assert.strictEqual(replaced.pid, 'pnew');
  assert.strictEqual(replaced.title, '页面pnew');
  assert.strictEqual('src' in replaced, false, 'src 快照应被清除');
  assert.strictEqual(cur.src, '/old.html', '入参不可变：原对象不动');
  assert.strictEqual(r2.tabSeq.n, 1, '复用不消耗序号');
});

test('open：当前标签已固定时新开标签，tabSeq 递增', async () => {
  const cur = mk('t1', { pinned: true });
  const r = tabs.open(model([cur]), PAGE('pnew'));
  assert.strictEqual(r.tabs.length, 2);
  assert.strictEqual(r.active, 't1');
  assert.strictEqual(r.tabSeq.n, 2);
  assert.strictEqual(r.tabs[1].id, 't1');
});

test('close：关闭激活项时激活转移到前一个；关闭末尾转移到后一个', async () => {
  const m = model([mk('t1'), mk('t2'), mk('t3')], 't2');
  let r = tabs.close(m, 't2');
  assert.deepStrictEqual(r.tabs.map(t => t.id), ['t1', 't3']);
  assert.strictEqual(r.active, 't1', 'idx-1 转移');
  r = tabs.close(m, 't3');
  assert.strictEqual(r.active, 't2', '越界回退到 idx-1');
  r = tabs.close(m, 't9');
  assert.strictEqual(r, null, '关闭不存在的标签无变化');
});

test('lruSweep：只休眠未固定非激活项，激活项/固定项永不离场（invariant）', async () => {
  const t1 = mk('t1', { lastActive: 1 });
  const t2 = mk('t2', { lastActive: 2, pinned: true });
  const t3 = mk('t3', { lastActive: 3 });
  const t4 = mk('t4', { lastActive: 4 });
  const m = model([t1, t2, t3, t4], 't4');
  const r = tabs.lruSweep(m, 2);
  const byId = Object.fromEntries(r.tabs.map(t => [t.id, t]));
  assert.strictEqual(byId.t4.sleep, false, '激活项永不休眠');
  assert.strictEqual(byId.t2.sleep, false, '固定项永不休眠');
  assert.strictEqual(byId.t1.sleep, true, '最久未用先休眠');
  assert.strictEqual(byId.t3.sleep, true);
  assert.strictEqual('src' in byId.t1, false, '休眠即销毁 src 快照');
  assert.strictEqual(t1.sleep, false, '入参不可变');
  assert.strictEqual(tabs.lruSweep(m, 8), null, '未超限无变化');
  const r2 = tabs.lruSweep(m, 1);
  assert.strictEqual(r2.tabs.filter(t => !t.sleep).length, 2, 'maxAlive 下限 2：最多清到 2 个');
});

test('restoreSession：只保留激活项 awake，其余全部懒休眠', async () => {
  const m = model([mk('t1', { sleep: true }), mk('t2'), mk('t3')], 't3');
  const r = tabs.restoreSession(m);
  assert.strictEqual(r.tabs.find(t => t.id === 't3').sleep, false);
  assert.strictEqual(r.tabs.find(t => t.id === 't2').sleep, true);
  assert.strictEqual(r.tabs.find(t => t.id === 't1').sleep, true, '已休眠的保持休眠');
});

test('setActive：目标在休眠态则唤醒（invariant 保证点）', async () => {
  const m = model([mk('t1'), mk('t2', { sleep: true, loading: false })], 't1');
  const r = tabs.setActive(m, 't2', 99);
  const t2 = r.tabs.find(t => t.id === 't2');
  assert.strictEqual(t2.sleep, false);
  assert.strictEqual(t2.loading, true);
  assert.strictEqual(t2.lastActive, 99);
  assert.strictEqual(tabs.setActive(m, 't1'), null, '重复激活无变化');
});

test('togglePin：翻转后固定项置顶', async () => {
  const m = model([mk('t1'), mk('t2')]);
  const r = tabs.togglePin(m, 't2');
  assert.deepStrictEqual(r.tabs.map(t => [t.id, t.pinned]), [['t2', true], ['t1', false]]);
});

test('closeOthers/closeAllUnpinned：保留固定与指定项', async () => {
  const m = model([mk('t1', { pinned: true }), mk('t2'), mk('t3'), mk('t4')], 't3');
  let r = tabs.closeOthers(m, 't3');
  assert.deepStrictEqual(r.tabs.map(t => t.id), ['t1', 't3']);
  assert.strictEqual(r.active, 't3');
  r = tabs.closeAllUnpinned(m);
  assert.deepStrictEqual(r.tabs.map(t => t.id), ['t1']);
  assert.strictEqual(r.active, 't1', '激活项被清时转移到第一个');
});

test('retargetSelfNav / renameSync / reload / markLoaded / pruneTabs', async () => {
  const m = model([mk('t1', { pid: 'p1', title: '旧' }), mk('t2', { pid: 'p2' })], 't1');
  let r = tabs.retargetSelfNav(m, 't1', { id: 'px', name: '新页', native: true });
  const t1 = r.tabs.find(t => t.id === 't1');
  assert.strictEqual(t1.pid, 'px');
  assert.strictEqual(t1.native, true);
  r = tabs.renameSync(m, 'p1', '改名');
  assert.strictEqual(r.tabs.find(t => t.id === 't1').title, '改名');
  assert.strictEqual(r.tabs.find(t => t.id === 't2').title, 'tt2');
  r = tabs.reload(m, 't1');
  assert.strictEqual(r.tabs[0].rc, 1);
  assert.strictEqual('src' in r.tabs[0], false);
  assert.strictEqual(r.tabs[0].loading, true);
  r = tabs.markLoaded(model([mk('t1', { loading: true })]), 't1');
  assert.strictEqual(r.tabs[0].loading, false);
  r = tabs.pruneTabs(m, pid => pid !== 'p2');
  assert.deepStrictEqual(r.tabs.map(t => t.id), ['t1']);
  assert.strictEqual(tabs.pruneTabs(m, () => true), null);
});

test('页面 URL 词汇：enc/srcOf 与旧版逐字节一致，matchPageByUrl 命中', async () => {
  assert.strictEqual(tabs.enc('01 登录.html'), '/01%20%E7%99%BB%E5%BD%95.html');
  assert.strictEqual(tabs.srcOf({ path: 'a.html' }), '/a.html');
  assert.strictEqual(tabs.srcOf({ native: true }), '/index.html');
  const projects = [{ id: 'p1', path: '01-登录页.html' }, { id: 'p2', path: 'index.html', native: true }];
  const hit = tabs.matchPageByUrl(projects, '/01-%E7%99%BB%E5%BD%95%E9%A1%B5.html', '', 'axhub://local/_axviewer/');
  assert.strictEqual(hit.id, 'p1');
  const native = tabs.matchPageByUrl(projects, '/index.html', '', 'axhub://local/_axviewer/');
  assert.strictEqual(native.id, 'p2');
});
