'use strict';
/*
 * 更新增强 · 安装前 preflight（纯逻辑，可注入 fs / 磁盘查询，便于 node --test）。
 * 校验两项：① 安装目录所在磁盘可用空间 ≥ MIN_DISK_FREE_MB；② 安装目录可写。
 * 返回 { ok, reason, detail }，reason 为 FailureReason 枚举值（ok 时为 null）。
 */
const { MIN_DISK_FREE_MB } = require('./constants.js');
const { FailureReason } = require('./errors.js');

/* 默认：用 fs.statfsSync 取目录所在盘可用空间（MB）。取不到则放行（不误杀）。 */
function defaultFreeDiskMb (dir) {
  try {
    const fs = require('fs');
    const s = fs.statfsSync(dir);
    return Math.floor((s.bavail * s.bsize) / (1024 * 1024));
  } catch (e) {
    return Infinity;
  }
}

/* 默认：用 fs.access(W_OK) 判断目录是否可写。 */
function defaultWritable (dir) {
  try {
    const fs = require('fs');
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch (e) {
    return false;
  }
}

/*
 * 执行 preflight 检查。
 * @param {object} [opts]
 * @param {string} [opts.installDir]   安装目录，默认 process.cwd()
 * @param {function(string):number} [opts.getFreeDiskMb]  注入：返回可用空间(MB)
 * @param {function(string):boolean} [opts.isWritable]    注入：返回目录是否可写
 * @returns {{ok:boolean,reason:string|null,detail:object}}
 */
function check (opts) {
  const o = opts || {};
  const installDir = o.installDir || process.cwd();
  const getFreeDiskMb = o.getFreeDiskMb || defaultFreeDiskMb;
  const isWritable = o.isWritable || defaultWritable;

  let free;
  try {
    free = getFreeDiskMb(installDir);
  } catch (e) {
    free = Infinity;
  }

  if (typeof free !== 'number' || free < MIN_DISK_FREE_MB) {
    return { ok: false, reason: FailureReason.DISK_SPACE, detail: { freeMb: free, minMb: MIN_DISK_FREE_MB } };
  }
  if (!isWritable(installDir)) {
    return { ok: false, reason: FailureReason.NO_WRITE_PERMISSION, detail: { dir: installDir } };
  }
  return { ok: true, reason: null, detail: {} };
}

module.exports = { check, defaultFreeDiskMb, defaultWritable };
