'use strict';
/*
 * update/download 单测：退避时序（30s→2min→5min）+ 耗尽 + 手动重试（fake timers）。
 * 运行：cd desktop && node --test src/update/__tests__/download.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const { createDownloadRetry } = require('../download.js');

/* 收集事件 + 捕获计划的定时器（fake timer） */
function makeHarness (downloadFn) {
  const events = [];
  const scheduled = [];
  const timers = {
    setTimeout: (cb, ms) => { const id = scheduled.length; scheduled.push({ cb, ms }); return id; },
    clearTimeout: (id) => { if (id != null && scheduled[id]) scheduled[id] = null; }
  };
  const retry = createDownloadRetry({ downloadFn, onEvent: (e) => events.push(e), timers, delays: [30000, 120000, 300000], maxRetries: 3 });
  return { events, scheduled, retry };
}

/* 触发第 i 个已安排的定时器（返回其 promise） */
async function fire (scheduled, i) {
  const item = scheduled[i];
  assert.ok(item, `应有第 ${i} 个退避定时器`);
  return item.cb();
}

test('退避时序：30s → 2min → 5min 且事件 attempt 递增', async () => {
  const { events, scheduled, retry } = makeHarness(() => Promise.reject(new Error('net down')));
  await retry.start();
  // 首试失败 → 第 1 次退避（30s）
  assert.strictEqual(scheduled.length, 1);
  assert.strictEqual(scheduled[0].ms, 30000);
  assert.deepStrictEqual(events[0], { type: 'download-retry', payload: { attempt: 1, max: 3, nextInMs: 30000, error: 'net down' } });

  await fire(scheduled, 0);
  assert.strictEqual(scheduled.length, 2);
  assert.strictEqual(scheduled[1].ms, 120000);
  assert.deepStrictEqual(events[1].payload, { attempt: 2, max: 3, nextInMs: 120000, error: 'net down' });

  await fire(scheduled, 1);
  assert.strictEqual(scheduled.length, 3);
  assert.strictEqual(scheduled[2].ms, 300000);
  assert.deepStrictEqual(events[2].payload, { attempt: 3, max: 3, nextInMs: 300000, error: 'net down' });
});

test('耗尽：第 3 次失败后推送 download-exhausted', async () => {
  const { events, scheduled, retry } = makeHarness(() => Promise.reject(new Error('net down')));
  await retry.start();
  await fire(scheduled, 0);
  await fire(scheduled, 1);
  await fire(scheduled, 2);
  // 不再安排新定时器
  assert.strictEqual(scheduled.length, 3);
  assert.strictEqual(events[3].type, 'download-exhausted');
  assert.strictEqual(events[3].payload.canRetry, true);
  assert.strictEqual(retry.isActive(), false);
});

test('手动重试：耗尽后 retryNow 立即重获完整预算', async () => {
  const { events, scheduled, retry } = makeHarness(() => Promise.reject(new Error('net down')));
  await retry.start();
  await fire(scheduled, 0);
  await fire(scheduled, 1);
  await fire(scheduled, 2);
  assert.strictEqual(retry.isActive(), false);

  const before = events.length;
  await retry.retryNow();
  // 立即发起首试（无新定时器，直接失败 → 第 1 次退避 30s）
  assert.strictEqual(scheduled.length, 4);
  assert.strictEqual(scheduled[3].ms, 30000);
  assert.deepStrictEqual(events[before], { type: 'download-retry', payload: { attempt: 1, max: 3, nextInMs: 30000, error: 'net down' } });
});

test('成功：下载成功后停止活动、无退避', async () => {
  const { events, scheduled, retry } = makeHarness(() => Promise.resolve());
  await retry.start();
  assert.strictEqual(retry.isActive(), false);
  assert.strictEqual(scheduled.length, 0);
  assert.strictEqual(events.length, 0);
});

test('start 重入：活动期内再次 start 不重复下载', async () => {
  let calls = 0;
  const { retry } = makeHarness(() => { calls++; return Promise.reject(new Error('x')); });
  const p1 = retry.start();
  const p2 = retry.start();
  await p1; await p2;
  assert.strictEqual(calls, 1, '首试只应调用一次 downloadFn');
});
