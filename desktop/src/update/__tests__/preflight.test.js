'use strict';
/*
 * update/preflight 单测：空间不足 / 只读目录 / 正常 三态（mock fs / 磁盘查询）。
 * 运行：cd desktop && node --test src/update/__tests__/preflight.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const { check } = require('../preflight.js');
const { FailureReason } = require('../errors.js');

test('正常：空间充足且可写 → ok', () => {
  const r = check({
    installDir: '/opt/app',
    getFreeDiskMb: () => 4096,
    isWritable: () => true
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.reason, null);
});

test('空间不足 → DISK_SPACE', () => {
  const r = check({
    installDir: '/opt/app',
    getFreeDiskMb: () => 50,   // < 300MB
    isWritable: () => true
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, FailureReason.DISK_SPACE);
  assert.strictEqual(r.detail.minMb, 300);
});

test('只读目录 → NO_WRITE_PERMISSION（空间充足也拦截）', () => {
  const r = check({
    installDir: '/readonly/app',
    getFreeDiskMb: () => 4096,
    isWritable: () => false
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, FailureReason.NO_WRITE_PERMISSION);
  assert.strictEqual(r.detail.dir, '/readonly/app');
});

test('取不到空间信息（Infinity）不误杀 → 放行', () => {
  const r = check({
    installDir: '/x',
    getFreeDiskMb: () => Infinity,
    isWritable: () => true
  });
  assert.strictEqual(r.ok, true);
});

test('getFreeDiskMb 抛错等价于取不到 → 放行', () => {
  const r = check({
    installDir: '/x',
    getFreeDiskMb: () => { throw new Error('statfs failed'); },
    isWritable: () => true
  });
  assert.strictEqual(r.ok, true);
});
