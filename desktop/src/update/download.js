'use strict';
/*
 * 更新增强 · 下载失败指数退避重试状态机（纯逻辑，可注入定时器与下载函数）。
 *
 * 行为（与架构时序一致）：
 *   - start() 立即发起首次下载；失败则按 RETRY_DELAYS 退避重试（30s → 2min → 5min），
 *     每次重试前向 onEvent 推送 { type:'download-retry', payload:{ attempt, max, nextInMs, error } }。
 *   - 达到 MAX_RETRIES 仍失败 → 推送 { type:'download-exhausted', payload: FailureDescriptor }。
 *   - 成功由外部 autoUpdater 'update-downloaded' 事件接管；本状态机仅负责失败重试。
 *   - retryNow() 在耗尽后由用户手动触发：清零计数并立即重试（重获完整重试预算）。
 *
 * 测试用：传入 timers（fake setTimeout/clearTimeout）+ downloadFn（稳定抛错）即可无等待验证时序。
 */
const { MAX_RETRIES, RETRY_DELAYS } = require('./constants.js');
const { FailureReason, describe } = require('./errors.js');

/*
 * 创建下载重试控制器。
 * @param {object} [opts]
 * @param {object} [opts.autoUpdater]      electron-updater 实例（提供 downloadUpdate）
 * @param {function():Promise<void>} [opts.downloadFn]  注入：默认 () => autoUpdater.downloadUpdate()
 * @param {function(object):void} [opts.onEvent]        注入：生命周期事件回调
 * @param {{setTimeout:Function,clearTimeout:Function}} [opts.timers]  注入定时器（测试用 fake）
 * @param {number[]} [opts.delays]         注入退避间隔（默认 RETRY_DELAYS）
 * @param {number} [opts.maxRetries]       注入最大重试（默认 MAX_RETRIES）
 */
function createDownloadRetry (opts) {
  const o = opts || {};
  const autoUpdater = o.autoUpdater || null;
  const downloadFn = o.downloadFn || (autoUpdater ? () => autoUpdater.downloadUpdate() : () => Promise.reject(new Error('no autoUpdater')));
  const onEvent = o.onEvent || (() => {});
  const timers = o.timers || { setTimeout: setTimeout, clearTimeout: clearTimeout };
  const delays = o.delays || RETRY_DELAYS;
  const maxRetries = (o.maxRetries != null) ? o.maxRetries : MAX_RETRIES;

  let active = false;   // 是否处于「下载/重试」活动期
  let busy = false;     // 单次下载进行中（防重入）
  let attempts = 0;     // 已发生的失败次数
  let timer = null;     // 当前退避定时器句柄

  function clearTimer () {
    if (timer != null) { timers.clearTimeout(timer); timer = null; }
  }

  async function attemptDownload () {
    if (busy) return;
    busy = true;
    try {
      await downloadFn();
      // 成功：交由 autoUpdater 'update-downloaded' 事件处理；此处收尾
      busy = false;
      active = false;
      clearTimer();
    } catch (e) {
      busy = false;
      onFailure(e);
    }
  }

  function onFailure (e) {
    if (attempts >= maxRetries) {
      active = false;
      clearTimer();
      const reason = FailureReason.UNKNOWN;
      onEvent({
        type: 'download-exhausted',
        payload: describe(reason, { message: (e && e.message) || String(e) })
      });
      return;
    }
    attempts++;
    const idx = Math.min(attempts - 1, delays.length - 1);
    const delay = delays[idx];
    onEvent({
      type: 'download-retry',
      payload: { attempt: attempts, max: maxRetries, nextInMs: delay, error: (e && e.message) || String(e) }
    });
    clearTimer();
    timer = timers.setTimeout(() => { attemptDownload(); }, delay);
  }

  function start () {
    if (active) return Promise.resolve();
    active = true;
    attempts = 0;
    clearTimer();
    return attemptDownload();
  }

  function retryNow () {
    clearTimer();
    attempts = 0;
    if (active) return attemptDownload();
    active = true;
    return attemptDownload();
  }

  function stop () {
    active = false;
    busy = false;
    clearTimer();
  }

  function isActive () { return active; }
  function getAttempt () { return attempts; }

  return { start, retryNow, stop, isActive, getAttempt };
}

module.exports = { createDownloadRetry };
