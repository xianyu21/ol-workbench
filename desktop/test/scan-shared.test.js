'use strict';
// 页面扫描共享逻辑测试（node:test）
// 页面 ID 是用户数据（收藏/标签/最近访问）的关联主键：本文件用与旧版实现逐字一致的
// 内联 djb2 交叉验证，防止共享模块被无意改动导致两端 ID 漂移、用户数据错乱。
const test = require('node:test');
const assert = require('node:assert');

const AxHubScan = require('../scan-shared.js');

// 旧版（迁移前 axhub-server.js 与 store.js 各自内联的算法，逐字复制于此）
function legacyPageId (name) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0;
  return 'p' + h.toString(36) + '_' + name.length.toString(36);
}

test('页面 ID 与旧版 djb2 算法逐字节一致（英文名 / 中文名 / 框架页名）', () => {
  const samples = ['a.html', '00-总览.html', '02-工作台_列表.html', 'start_c_1.html', '中文 页面.htm', 'x'.repeat(120) + '.html'];
  for (const s of samples) assert.strictEqual(AxHubScan.computePageId(s), legacyPageId(s), 'ID 漂移: ' + s);
});

test('框架页过滤：白名单 / start* 通配 / 通用组件 / 非 html 全部命中', () => {
  for (const f of ['index.html', 'start.html', 'start_c_1.html', 'start_with_pages.html',
    '通用组件.html', 'start_with_pages (1).html', 'start_abc.html', 'START-2.html']) {
    assert.ok(AxHubScan.isFrameFile(f), '应视为框架页: ' + f);
  }
  for (const f of ['data.json', 'readme.md', 'logo.png']) {
    assert.ok(!AxHubScan.isFrameFile(f), '非 html 不属于页面过滤范围: ' + f);
  }
  for (const f of ['00-总览.html', '中文 页面.html', 'index2.html', 'reading.html']) {
    // 旧版正则 start[^.]*\.html 会把 start<无点段>.html 全部当框架页（含 startup/starts），
    // 属于既有行为，保持不变；这里验证非 start 前缀的业务页不受影响
    assert.ok(!AxHubScan.isFrameFile(f), '业务页不应误杀: ' + f);
  }
});

test('分组与页面名：编号前缀首段分组，无编号归未分组', () => {
  assert.strictEqual(AxHubScan.baseNameOf('00-07-01_登录页.html'), '00-07-01_登录页');
  assert.strictEqual(AxHubScan.groupOf('00-07-01_登录页'), '00');
  assert.strictEqual(AxHubScan.groupOf('login'), '未分组');
});

test('排序：按路径 zh 排序（原数组上排序，与旧版一致；zh collation 下 - 先于数字比较）', () => {
  const pages = [{ path: '10-x.html' }, { path: '02-y.html' }, { path: '1-z.html' }];
  const out = AxHubScan.sortPages(pages);
  assert.deepStrictEqual(out.map(p => p.path), ['02-y.html', '1-z.html', '10-x.html']);
});
