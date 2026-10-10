'use strict';
/*
 * WorkspaceHost（工作区宿主）conformance 契约测试
 * 运行：cd desktop && node --test test/host-conformance.test.js
 *
 * 同一份用例跑遍所有后端（electron / headless），再加 1 个「坏后端」
 * 必须被抓出来 —— 证明这套契约有牙齿，而不是一份谁都能过的空壳。
 *
 * 新后端接入规则：把后端加进 buildBackends()，跑同一套用例，全绿才允许注册。
 */
const test = require('node:test');
const assert = require('node:assert');

let M;
test.before(async () => { M = await import('../viewer/src/host/index.js'); });

const QUERY_CASES = [
  { name: 'chooseWorkspace', args: [], shape: r => r === null || (typeof r.name === 'string' && (Array.isArray(r.pages) || r.pages === null)) },
  { name: 'readPageManifest', args: [], shape: r => r && typeof r === 'object' },
  { name: 'chooseDocuments', args: [], shape: r => Array.isArray(r) },
  { name: 'readDocuments', args: [['a.md']], shape: r => Array.isArray(r) },
  { name: 'appVersion', args: [], shape: r => typeof r === 'string' },
  { name: 'lookForUpdate', args: [], shape: r => r === null || typeof r === 'object' }
];
const COMMANDS = ['applyUpdate', 'setBackgroundDownload', 'answerExitRequest', 'setPreferredExitAction'];
const SUBSCRIPTIONS = ['onDownloadProgress', 'onUpdateFound', 'onUpdateStaged', 'onExitRequest'];

/* ── 被所有后端共享的契约断言 ──────────────────────────────────────────── */
async function checkContract (host, ctx) {
  // 1) 身份与能力声明
  assert.ok(typeof host.id === 'string' && host.id, '宿主必须声明后端 id');
  assert.ok(Array.isArray(host.capabilities), 'capabilities 必须是数组');
  assert.ok(Object.isFrozen(host.capabilities), 'capabilities 必须冻结（禁止运行期篡改能力集）');
  assert.strictEqual(typeof host.supports, 'function', '必须提供 supports()');
  host.capabilities.forEach(c => {
    assert.ok(M.ALL_CAPABILITIES.indexOf(c) >= 0, `能力 ${c} 未在契约清单登记：禁止后端自造能力名`);
  });

  // 2) 查询型：一律返回 Promise；不支持必须 reject（禁止静默 undefined）
  for (const c of QUERY_CASES) {
    if (!host.supports(c.name)) {
      await assert.rejects(() => host[c.name](...c.args), (e) => {
        assert.strictEqual(e.code, 'UNSUPPORTED_CAPABILITY', `${c.name} 不支持时必须抛 UnsupportedCapability`);
        assert.strictEqual(e.capability, c.name, '错误必须携带能力名');
        return true;
      }, `${host.id}：${c.name} 不支持时未 reject（静默失败 = 假 SPI）`);
      continue;
    }
    const p = host[c.name](...c.args);
    assert.ok(p && typeof p.then === 'function', `${host.id}：${c.name} 必须返回 Promise`);
    const r = await p;
    // 查询型返回值不得为 undefined：undefined = 静默失败，正是假 SPI 的典型形态
    assert.notStrictEqual(r, undefined, `${host.id}：${c.name} 静默返回 undefined（查询型必须有返回值）`);
    assert.ok(c.shape(r), `${host.id}：${c.name} 返回值形状不合契约`);
  }

  // 3) 命令型：fire-and-forget，不支持即 no-op 且不得抛
  for (const name of COMMANDS) {
    const p = host[name]('x', true);
    assert.ok(p && typeof p.then === 'function', `${host.id}：${name} 必须返回 Promise`);
    await p;
  }

  // 4) 订阅型：必须返回可用的 unsubscribe 函数，且 unsubscribe 幂等
  for (const name of SUBSCRIPTIONS) {
    const off = host[name](() => {});
    assert.strictEqual(typeof off, 'function', `${host.id}：${name} 必须返回 unsubscribe`);
    off(); off(); // 幂等：重复退订不得抛
  }

  // 5) 语义：选目录取消必须返回 null 而不是 undefined / false
  if (host.supports('chooseWorkspace') && ctx && ctx.cancelPick) {
    assert.strictEqual(await host.chooseWorkspace(), null, '用户取消选目录必须返回 null');
  }

  // 6) 语义：归档 → 丢弃 的时序（后端必须真的把快照交出去）
  if (host.supports('archiveSnapshot') && host.supports('discardSnapshot') && ctx && ctx.store) {
    await host.archiveSnapshot({ 'wb_test': { v: 1 } });
    if (ctx.readBack) {
      assert.deepStrictEqual(ctx.readBack(), { v: 1 }, `${host.id}：归档内容未被宿主收下`);
    }
    await host.discardSnapshot();
    if (ctx.readBack) {
      assert.strictEqual(ctx.readBack(), undefined, `${host.id}：discardSnapshot 未真正清除快照`);
    }
  }

  // 7) 接口纯净性：接口模块不得出现任何厂商/技术名词（AP-02）
  //    （单独用例 assertPurity 里做，这里只保证运行期不炸）
}

/* ── 后端构造 ────────────────────────────────────────────────────────── */
async function buildBackends () {
  const [{ createElectronHost }, { createHeadlessHost }] = await Promise.all([
    import('../viewer/src/host/electron.js'),
    import('../viewer/src/host/headless.js')
  ]);

  // 假壳桥：完全按 preload 的 17 个方法签名模拟
  const bridgeCalls = [];
  const snapshot = new Map();
  const fakeBridge = {
    selectDir: async () => { bridgeCalls.push('selectDir'); return '/data/axhub'; },
    clearDir: async () => { bridgeCalls.push('clearDir'); },
    getTree: async () => { bridgeCalls.push('getTree'); return { name: 'root', root: '/data/axhub', hasData: true, pages: [] }; },
    pickApiFiles: async () => { bridgeCalls.push('pickApiFiles'); return ['a.md']; },
    readApiFiles: async (p) => { bridgeCalls.push('readApiFiles'); return p.map(x => ({ name: x, path: x, size: 1, text: '# t' })); },
    version: async () => { bridgeCalls.push('version'); return '1.1.5'; },
    checkUpdate: async () => { bridgeCalls.push('checkUpdate'); return { ok: true, available: false }; },
    installUpdate: () => { bridgeCalls.push('installUpdate'); },
    setSilentUpdate: (on) => { bridgeCalls.push('setSilentUpdate:' + on); },
    saveUserData: (d) => { bridgeCalls.push('saveUserData'); snapshot.set('snapshot', d); },
    clearUserData: () => { bridgeCalls.push('clearUserData'); snapshot.delete('snapshot'); },
    onUpdateProgress: () => {}, onUpdateAvailable: () => {}, onUpdateReady: () => {},
    onCloseActionRequest: () => {}, applyCloseAction: () => {}, saveCloseAction: () => {}
  };

  const store = new Map();
  const backends = [
    {
      id: 'electron(假壳桥)',
      host: createElectronHost(fakeBridge),
      ctx: { store: snapshot, readBack: () => { const s = snapshot.get('snapshot'); return s && s['wb_test']; } }
    },
    {
      id: 'headless',
      host: createHeadlessHost({
        store,
        manifest: { name: 'root', root: '/x', hasData: true, pages: [] },
        version: '9.9.9',
        documents: { 'a.md': { name: 'a.md', path: 'a.md', size: 1, text: '# t' } },
        documentPaths: ['a.md'],
        workspaceName: 'ws',
        pages: [{ id: 'p1', name: 'p1', path: 'p1.html' }]
      }),
      ctx: { store, readBack: () => { const s = store.get('snapshot'); return s && s['wb_test']; } }
    },
    {
      id: 'headless(取消选目录)',
      host: createHeadlessHost({ pickCancelled: true }),
      ctx: { cancelPick: true }
    }
  ];
  return backends;
}

/* ── 用例：每个后端跑同一套契约 ───────────────────────────────────────── */
test('conformance：electron / headless 后端通过同一套契约', async () => {
  const list = await buildBackends();
  assert.ok(list.length >= 2, '至少要有 2 个后端参与 conformance');
  for (const b of list) {
    await checkContract(b.host, b.ctx);
  }
});

/* 浏览器后端已在 A 阶段裁剪，此处仅保留 electron + headless 两后端的 conformance。 */

/* ── 负向用例：坏后端必须被抓出来（证明套件有牙齿，AP-03） ─────────────── */
test('负向：坏后端（不支持的能力静默返回 undefined）必须被 conformance 判死', async () => {
  const bad = M.makeHost('bad', {
    // 声称支持 lookForUpdate，实际返回 undefined —— 静默失败的典型
    capabilities: ['lookForUpdate'],
    lookForUpdate: () => undefined
  });
  let caught = null;
  try {
    await checkContract(bad, {});
  } catch (e) {
    caught = e;
  }
  assert.ok(caught, '坏后端必须被 conformance 抓出来；没抓到说明这套用例没有牙齿');
  assert.ok(/lookForUpdate/.test(caught.message), '应被 lookForUpdate 的契约断言抓住：' + caught.message);
});

test('负向：后端自造能力名必须被判死（禁止绕过契约清单）', async () => {
  const rogue = M.makeHost('rogue', { capabilities: ['readSomeThingCustom'], readSomeThingCustom: async () => 1 });
  let caught = null;
  try { await checkContract(rogue, {}); } catch (e) { caught = e; }
  assert.ok(caught, '未在 ALL_CAPABILITIES 登记的能力名必须被拒');
  assert.ok(/未在契约清单登记/.test(caught.message), caught.message);
});

/* ── 接口纯净性（AP-02）：接口文件内不得出现厂商/技术名词 ─────────────── */
test('接口纯净性：语义接口内不得出现厂商/技术名词', async () => {
  // 注意：本文件保持 CJS（其余测试同风格），禁止使用 import.meta，否则 Node 22
  // 的模块类型探测会把它判成 ESM 而 require 失效。
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'viewer', 'src', 'host', 'index.js'), 'utf8');
  // 只检查「能力声明区」本身（QUERIES/COMMANDS/SUBSCRIPTIONS 数组）：
  // 文件头的纪律说明与后端注册注释里提到技术名词是正常的，能力名/契约体里出现则是泄漏。
  const head = src.slice(src.indexOf('export const QUERIES'), src.indexOf('export function makeHost'));
  const banned = ['electron', 'ipc', 'preload', 'localStorage', 'fetch', 'FileSystem', 'showDirectoryPicker', 'window.axhub'];
  banned.forEach(w => {
    // 允许在「禁止出现」的纪律说明里出现一次（即注释本身在列举禁用词）
    const hits = head.toLowerCase().split(w.toLowerCase()).length - 1;
    assert.ok(hits <= 1, `接口契约区出现技术名词「${w}」${hits} 次（>1 说明不是纪律说明而是真实泄漏）`);
  });
  // 后端名只允许出现在工厂的注册处
  const tail = src.slice(src.indexOf('export function createHost'));
  assert.ok(/electron|browser|headless/.test(tail), '后端名应集中在工厂注册处');
});

/* ── 接线守界（AP-04）：业务层不得绕过接口直连实现 ───────────────────── */
const fs = require('node:fs');
const path = require('node:path');
const SRC_ROOT = path.join(__dirname, '..', 'viewer', 'src');

/* 去掉注释后的真实代码：行注释 + 块注释 + JSDoc，避免把迁移说明误判成泄漏 */
function stripComments (txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/* 扫描业务源码：命中关键字即视为绕过接口（allow 白名单里的实现内部不算） */
function findLeaks (keyword, allowFile) {
  const offenders = [];
  (function walk (dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(js|vue)$/.test(e.name)) continue;
      if (allowFile && allowFile.test(p)) continue;
      const txt = stripComments(fs.readFileSync(p, 'utf8'));
      const n = txt.split(new RegExp(keyword, 'g')).length - 1;
      if (n) offenders.push(path.relative(SRC_ROOT, p) + ' → ' + n + ' 处');
    }
  })(SRC_ROOT);
  return offenders;
}

test('守界：业务源码中不得残留 window.axhub 直连', () => {
  // host/ 是适配器目录，允许出现实现名；除它之外的业务层一律不得直连
  assert.deepStrictEqual(
    findLeaks('window\\.axhub', /[\\/]host[\\/]/),
    [],
    '业务层仍直连宿主实现（AP-04）：宿主能力必须全部经 host/index.js'
  );
});

test('守界：实现名只允许留在 host/ 适配器目录内', () => {
  // 反向验证上一条不是靠白名单蒙混：host/ 内确实有实现名（说明扫描器真的在工作）
  assert.ok(
    findLeaks('window\\.axhub').length > 0,
    '扫描器必须能在 host/ 内找到实现名，否则上一条守界断言可能是假阳性'
  );
});

test('守界：业务层（含备份弹窗）不得直调 localStorage', () => {
  assert.deepStrictEqual(
    findLeaks('localStorage', /[\\/]user-data\.js$/),
    [],
    '持久层之外仍直调 localStorage（AP-04）：必须经 userData.readSnapshot/get/set'
  );
});
