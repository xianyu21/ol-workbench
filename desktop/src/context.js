'use strict';
/*
 * 运行期共享上下文（app.start 装配后填充）。
 * 各子模块（protocol / window / tray / updater / ipc/*）统一从这里取共享状态，
 * 这样子模块在 require 时不依赖 electron，便于 node --test 用 mock 注入测试。
 */
const config = require('./config.js');

const ctx = {
  deps: null,            // 注入的原生依赖与配置（app/BrowserWindow/dialog/ipcMain/Menu/Tray/nativeImage/shell/protocol/net/autoUpdater...）
  log: console.log,      // 日志函数（start 后由 logger 注入）
  win: null,             // 主窗口实例
  tray: null,            // 托盘实例
  savedDir: null,        // 上次记住的 AxHub 目录
  quitting: false,       // 真正退出（托盘退出/更新安装）时置 true，放行 close
  VERSION: '',            // 版本号（来自 package.json）
  PORTABLE: false,       // 是否便携版
  RELEASES_URL: '',      // 发布页地址
  PRELOAD: '',           // preload 脚本路径
  userDataPath: '',      // userData 目录
  config,                // 配置读写（loadConfig/saveConfig/loadDir/saveDir）

  /* 渲染层消息（窗口可能未创建/已销毁，静默失败） */
  sendToWin (channel, payload) {
    try { if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, payload); } catch (e) { /* ignore */ }
  }
};

module.exports = ctx;
