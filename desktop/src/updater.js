'use strict';
/*
 * 在线更新（electron-updater）装配 + 更新增强 P0 逻辑（渠道 / preflight / 重试 / 回滚）。
 * 全部经 context 取依赖，不 require electron。纯逻辑下沉到 ./update/* 便于测试。
 */
const path = require('path');
const ctx = require('./context.js');
const preflight = require('./update/preflight.js');
const rollback = require('./update/rollback.js');
const constants = require('./update/constants.js');
const errors = require('./update/errors.js');
const { createDownloadRetry } = require('./update/download.js');

/* ── 模块级状态（主进程单例）──────────────────────────────────────────── */
let AU = null;                 // autoUpdater 实例
let retry = null;              // 下载重试控制器
let firstLaunchPending = false;// 是否为「更新后首启」（看门狗仅此态生效）
let firstLaunchTimer = null;   // 首启看门狗定时器

/* 取安装目录（NSIS 安装位置），用于 preflight */
function getInstallDir () {
  try {
    const app = ctx.deps && ctx.deps.app;
    if (app && app.getPath) return path.dirname(app.getPath('exe'));
  } catch (e) { /* ignore */ }
  return path.dirname(process.execPath);
}

/* preflight：安装前检查磁盘空间 + 目录可写 */
function runInstallPreflight () {
  return preflight.check({ installDir: getInstallDir() });
}

/* 向渲染层推送 status 事件（启动 / 渠道变更 / 状态对账用） */
function pushStatus () {
  const st = ctx.config.getUpdateState();
  ctx.sendToWin('update:event', {
    type: 'status',
    payload: {
      version: ctx.VERSION,
      channel: st.channel || 'stable',
      lastKnownGood: st.lastKnownGoodVersion || ctx.VERSION,
      portable: ctx.PORTABLE
    }
  });
}

/* 启动前应用渠道：必须在首轮 checkForUpdates 之前设定 */
function applyChannel () {
  if (!AU) return;
  const ch = ctx.config.getUpdateState().channel || 'stable';
  try { AU.channel = ch; } catch (e) { ctx.log('applyChannel error:', e && e.message); }
}

/* 取下载重试控制器（懒创建） */
function getDownloadRetry () {
  if (!retry) {
    retry = createDownloadRetry({
      autoUpdater: AU,
      onEvent: (ev) => {
        // 下载 exhausted 时收尾（避免阻塞后续检查）
        if (ev.type === 'download-exhausted') ctx.sendToWin('update:event', ev);
        else if (ev.type === 'download-retry') ctx.sendToWin('update:event', ev);
      }
    });
  }
  return retry;
}

/* ── 首启看门狗 + 回滚 ─────────────────────────────────────────────────── */
function armFirstLaunchWatchdog () {
  if (firstLaunchTimer) { clearTimeout(firstLaunchTimer); firstLaunchTimer = null; }
  firstLaunchTimer = setTimeout(() => {
    if (!firstLaunchPending) return;
    firstLaunchPending = false;
    const st = ctx.config.getUpdateState();
    const oldV = st.pendingInstall && st.pendingInstall.oldVersion;
    doRollback(oldV, 'FIRST_LAUNCH');
  }, constants.FIRST_LAUNCH_TIMEOUT_MS);
}

/* 渲染层 UI 就绪信号：首启成功，固化 lastKnownGood 并清 pendingInstall */
function markFirstLaunchReady () {
  if (!firstLaunchPending) return;
  firstLaunchPending = false;
  if (firstLaunchTimer) { clearTimeout(firstLaunchTimer); firstLaunchTimer = null; }
  const st = ctx.config.getUpdateState();
  const newV = (st.pendingInstall && st.pendingInstall.newVersion) || ctx.VERSION;
  ctx.config.setUpdateState({ lastKnownGoodVersion: newV, pendingInstall: null });
  pushStatus();
}

/* 真正执行回滚：发失败事件（首启异常）/ 拉旧包 / 覆盖安装 / 退 */
function doRollback (oldVersion, trigger) {
  const failType = trigger === 'FIRST_LAUNCH' ? 'first-launch-failed' : 'rollback-failed';
  ctx.sendToWin('update:event', { type: failType, payload: { oldVersion: oldVersion || '', reason: trigger } });

  if (!oldVersion) {
    ctx.sendToWin('update:event', {
      type: 'rollback-failed',
      payload: errors.describe(errors.FailureReason.UNKNOWN, { message: '回滚失败：缺少可用旧版本' })
    });
    return;
  }
  const deps = rollbackDeps();
  rollback.prepare(oldVersion, deps)
    .then((installerPath) => {
      // 封锁坏版本 + 标记回滚首启，覆盖安装后由旧版本首启派发 rolled-back
      ctx.config.setUpdateState({ blockedVersion: ctx.VERSION, justRolledBack: true });
      rollback.exec(installerPath, deps);
      if (ctx.deps && ctx.deps.app) ctx.deps.app.quit();
    })
    .catch((e) => {
      ctx.sendToWin('update:event', {
        type: 'rollback-failed',
        payload: errors.describe(errors.FailureReason.UNKNOWN, { message: (e && e.message) || String(e) })
      });
    });
}

/* 组装回滚依赖（默认走真实 https/os/child_process，便于测试注入） */
function rollbackDeps () {
  return {
    releasesUrl: ctx.RELEASES_URL,
    fs: require('fs'),
    os: require('os'),
    https: require('https'),
    spawn: require('child_process').spawn,
    tempDir: require('os').tmpdir()
  };
}

/* 手动回滚（设置页二次确认后触发）：回滚到 lastKnownGood */
async function triggerManualRollback () {
  const st = ctx.config.getUpdateState();
  const oldV = st.lastKnownGoodVersion;
  if (!oldV || oldV === ctx.VERSION) {
    ctx.sendToWin('update:event', {
      type: 'rollback-failed',
      payload: errors.describe(errors.FailureReason.UNKNOWN, { message: '无可回滚版本' })
    });
    return false;
  }
  doRollback(oldV, 'MANUAL');
  return true;
}

/* 启动期对账：pendingInstall 首启 / justRolledBack 派发 */
function onBootReconcile () {
  const st = ctx.config.getUpdateState();
  if (st.justRolledBack) {
    // 当前即为回滚后的旧版本首启
    ctx.config.setUpdateState({ justRolledBack: false });
    ctx.sendToWin('update:event', {
      type: 'rolled-back',
      payload: { oldVersion: ctx.VERSION, reason: 'ROLLED_BACK' }
    });
    pushStatus();
    return;
  }
  if (st.pendingInstall) {
    firstLaunchPending = true;
    armFirstLaunchWatchdog();
  }
  pushStatus();
}

/* 渲染进程崩溃：若处于首启待确认态，视为首启异常并回滚 */
function onWebContentsCrashed () {
  if (!firstLaunchPending) return;
  firstLaunchPending = false;
  const st = ctx.config.getUpdateState();
  const oldV = st.pendingInstall && st.pendingInstall.oldVersion;
  doRollback(oldV, 'FIRST_LAUNCH');
}

/**
 * 装配自动更新。
 * @param {{autoUpdater: object}} deps
 */
function setupAutoUpdater ({ autoUpdater }) {
  AU = autoUpdater;
  const { log, VERSION, PORTABLE, RELEASES_URL, deps } = ctx;
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };
  autoUpdater.autoDownload = ctx.config.loadConfig().silentUpdate !== false; // 后台静默下载（默认开启）
  autoUpdater.autoInstallOnAppQuit = true;                                  // 已下载的更新在退出应用时自动安装

  applyChannel(); // 首轮检查前先落实渠道

  autoUpdater.on('update-available', async (info) => {
    log('update available:', info && info.version, PORTABLE ? '(portable)' : '');
    if (!ctx.win) return;

    // 防重装循环：命中被回滚封锁的坏版本则跳过
    const st = ctx.config.getUpdateState();
    if (st.blockedVersion && info.version === st.blockedVersion) {
      log('skipping blocked version', info.version);
      return;
    }

    // GitHub Release 的 body 即更新内容；可能是 markdown/html，去标签后展示
    let notes = info && (info.releaseNotes || '');
    if (typeof notes === 'object' && notes) notes = notes.content || '';
    notes = String(notes).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

    if (PORTABLE) {
      const r = await deps.dialog.showMessageBox(ctx.win, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 v${info.version}（当前 v${VERSION}）。`,
        detail: (notes ? `更新内容：\n\n${notes}\n\n` : '') + '便携版不支持自动更新，请到 Releases 页面重新下载。',
        buttons: ['打开 Releases 页面', '以后再说'], defaultId: 0, cancelId: 1
      });
      if (r.response === 0) deps.shell.openExternal(RELEASES_URL).catch(() => {});
      return;
    }

    if (autoUpdater.autoDownload) {
      // 静默分支：后台直接下载，走 DownloadRetry（失败退避重试）
      if (getDownloadRetry().isActive()) return;
      ctx.sendToWin('update:available', { version: info.version });
      getDownloadRetry().start();
      return;
    }

    // 非静默分支（设置里关掉「后台静默下载」）：下载前询问
    const detail = notes ? `更新内容：\n\n${notes}\n\n` : '';
    const r = await deps.dialog.showMessageBox(ctx.win, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 v${info.version}（当前 v${VERSION}），是否下载更新？`,
      detail,
      buttons: ['立即下载', '以后再说'],
      defaultId: 0, cancelId: 1
    });
    if (r.response !== 0) return;
    try {
      await autoUpdater.downloadUpdate();
    } catch (e) {
      log('download error:', e && e.message);
      if (ctx.win) deps.dialog.showErrorBox('更新失败', '下载更新失败：\n' + (e && e.message || e));
    }
  });

  autoUpdater.on('download-progress', (p) => {
    if (!ctx.win || !p || p.percent == null) return;
    if (!autoUpdater.autoDownload) ctx.win.setTitle(`AxHub 原型工作台 · 正在下载更新 ${Math.round(p.percent)}%`);
    ctx.sendToWin('update:progress', Math.round(p.percent));
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (ctx.win) ctx.win.setTitle('AxHub 原型工作台');
    log('update downloaded:', info && info.version, '（退出应用时自动安装）');
    const newV = (info && info.version) || '';
    // 标记待安装，供首启对账 + 看门狗
    ctx.config.setUpdateState({ pendingInstall: { newVersion: newV, oldVersion: ctx.VERSION, stagedAt: Date.now() } });
    ctx.sendToWin('update:progress', null);
    ctx.sendToWin('update:ready', { version: newV });
  });

  autoUpdater.on('error', (e) => {
    if (ctx.win) ctx.win.setTitle('AxHub 原型工作台');
    ctx.sendToWin('update:progress', null);
    // 静默：无网络/无更新源（含 beta 未产出）时只记日志；检查失败由渲染层展示
    log('autoUpdater error:', e && e.message);
  });

  // 启动 5 秒后静默检查一次，此后每 24h 复查；渠道已在 applyChannel 设定
  const checkSilently = () => {
    log('checkForUpdates...');
    autoUpdater.checkForUpdates().catch(() => {});
  };
  setTimeout(checkSilently, 5000);
  setInterval(checkSilently, 24 * 60 * 60 * 1000);
}

module.exports = {
  setupAutoUpdater,
  applyChannel,
  getDownloadRetry,
  pushStatus,
  onBootReconcile,
  markFirstLaunchReady,
  onWebContentsCrashed,
  triggerManualRollback,
  runInstallPreflight,
  getInstallDir
};
