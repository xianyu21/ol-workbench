'use strict';
/*
 * 更新增强 · 常量单源（纯逻辑，零 Vue / 零 electron 硬依赖，可 node --test）。
 * 任何退避 / 超时 / 空间阈值改动只改此处，主进程各模块 import 引用。
 */

/* 更新渠道：默认请求 latest.yml（= stable）；'beta' 请求 latest-beta.yml */
const CHANNELS = Object.freeze(['stable', 'beta']);

/* 下载失败最大重试次数（退避期间的总尝试次数，不含首试） */
const MAX_RETRIES = 3;

/* 退避间隔（ms）：30s → 2min → 5min，长度须与 MAX_RETRIES 对齐 */
const RETRY_DELAYS = Object.freeze([30000, 120000, 300000]);

/* 首启看门狗超时（ms）：更新后首启若超时未就绪则判定首启异常并回滚 */
const FIRST_LAUNCH_TIMEOUT_MS = 30000;

/* 安装前 preflight 要求的最小可用磁盘空间（MB） */
const MIN_DISK_FREE_MB = 300;

function isChannel (v) {
  return CHANNELS.indexOf(v) >= 0;
}

module.exports = {
  CHANNELS,
  MAX_RETRIES,
  RETRY_DELAYS,
  FIRST_LAUNCH_TIMEOUT_MS,
  MIN_DISK_FREE_MB,
  isChannel
};
