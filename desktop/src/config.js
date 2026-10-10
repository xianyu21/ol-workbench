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

module.exports = { initConfig, loadConfig, saveConfig, loadDir, saveDir };
