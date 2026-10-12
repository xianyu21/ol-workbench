'use strict';
/*
 * update/errors 单测：FailureReason 枚举穷尽 + describe() + mapInstallError() 归因。
 * 运行：cd desktop && node --test src/update/__tests__/errors.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const { FailureReason, describe, mapInstallError } = require('../errors.js');

test('FailureReason 枚举值齐全且冻结', () => {
  assert.ok(Object.isFrozen(FailureReason), '枚举必须冻结');
  assert.deepStrictEqual(
    Object.keys(FailureReason).sort(),
    ['AV_BLOCKED', 'DISK_SPACE', 'FILE_IN_USE', 'NO_WRITE_PERMISSION', 'UNKNOWN'].sort()
  );
  Object.keys(FailureReason).forEach(k => assert.strictEqual(typeof FailureReason[k], 'string'));
});

test('describe() 返回 title/hint/action/canRetry 并携带 reason', () => {
  const d = describe(FailureReason.DISK_SPACE);
  assert.strictEqual(d.reason, 'DISK_SPACE');
  assert.strictEqual(typeof d.title, 'string');
  assert.strictEqual(typeof d.hint, 'string');
  assert.strictEqual(typeof d.action, 'string');
  assert.strictEqual(typeof d.canRetry, 'boolean');
});

test('describe() 未知 reason 回退到 UNKNOWN', () => {
  const d = describe('NOT_A_REASON');
  assert.strictEqual(d.reason, 'NOT_A_REASON');
  assert.strictEqual(d.title, describe(FailureReason.UNKNOWN).title);
});

test('describe() 合并 extra 字段', () => {
  const d = describe(FailureReason.UNKNOWN, { message: 'boom', code: 7 });
  assert.strictEqual(d.message, 'boom');
  assert.strictEqual(d.code, 7);
});

test('mapInstallError 按关键字归类', () => {
  assert.strictEqual(mapInstallError(new Error('ENOSPC no space left on device')), FailureReason.DISK_SPACE);
  assert.strictEqual(mapInstallError(new Error('EACCES permission denied')), FailureReason.NO_WRITE_PERMISSION);
  assert.strictEqual(mapInstallError(new Error('file is being used by another process')), FailureReason.FILE_IN_USE);
  assert.strictEqual(mapInstallError(new Error('blocked by antivirus')), FailureReason.AV_BLOCKED);
});

test('mapInstallError 按退出码归类', () => {
  assert.strictEqual(mapInstallError({ code: 5 }), FailureReason.NO_WRITE_PERMISSION);   // ERROR_ACCESS_DENIED
  assert.strictEqual(mapInstallError({ code: 740 }), FailureReason.NO_WRITE_PERMISSION); // 需提权
  assert.strictEqual(mapInstallError({ code: 32 }), FailureReason.FILE_IN_USE);          // ERROR_SHARING_VIOLATION
});

test('mapInstallError 无法归类归为 UNKNOWN', () => {
  assert.strictEqual(mapInstallError(new Error('something weird happened')), FailureReason.UNKNOWN);
  assert.strictEqual(mapInstallError(null), FailureReason.UNKNOWN);
  assert.strictEqual(mapInstallError(undefined), FailureReason.UNKNOWN);
});
