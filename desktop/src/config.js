'use strict';
/*
 * 桌面端配置（注入式）：目录绑定 / 关闭行为 / 静默更新等落盘到
 * userData/axhub-desktop.json。initConfig(userDataPath) 设定存储路径，
 * 由 app.start 在装配期注入，便于测试用临时目录替换。
 */
const fs = require('fs');
const path = require('path');

let CONFIG_PATH = null;

function initConfig (userDataPath) {
  CONFIG_PATH = path.join(userDataPath || process.cwd(), 'axhub-desktop.json');
}

function loadConfig () {
  if (!CONFIG_PATH) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) || {}; }
  catch (e) { return {}; }
}

function saveConfig (patch) {
  if (!CONFIG_PATH) return;
  try {
    const cfg = Object.assign(loadConfig(), patch);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  } catch (e) { /* ignore */ }
}

function loadDir () { return loadConfig().dir || null; }
function saveDir (d) { saveConfig({ dir: d }); }

/*
 * 更新增强 · 应用级更新状态（命名空间 update:，落盘 axhub-desktop.json）。
 * 这些字段必须由主进程在渲染层存在之前读/写（渠道启动即生效、lastKnownGood 启动即写、
 * pendingInstall 安装后即写），因此不入 user-keys.js（渲染用户数据快照）。
 * 既有顶层字段 silentUpdate / dir 保持不变。
 */
function getUpdateState () {
  const c = loadConfig();
  return Object.assign({
    channel: 'stable',            // 'stable' | 'beta'
    lastKnownGoodVersion: '',     // 末次成功启动版本；空 → 回退当前 VERSION
    pendingInstall: null,         // { newVersion, oldVersion, stagedAt } 待安装标记
    blockedVersion: null,         // 回滚后封锁的坏版本，避免重装循环
    justRolledBack: false         // 本次启动是回滚后的首启（用于派发 rolled-back）
  }, c.update || {});
}

function setUpdateState (patch) {
  if (!CONFIG_PATH) return;
  try {
    const c = loadConfig();
    const cur = getUpdateState();
    c.update = Object.assign({}, cur, patch);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2));
  } catch (e) { /* ignore */ }
}

module.exports = {
  initConfig, loadConfig, saveConfig, loadDir, saveDir,
  getUpdateState, setUpdateState
};
