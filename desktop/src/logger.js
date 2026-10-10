'use strict';
/*
 * 主进程日志（P2-4 异步化）：批量 + 后台 flush，保持 1MB 轮转语义。
 * UI 热路径调用 log(...) 不会阻塞事件循环；退出前可 log.flush() 强制落盘。
 */
const fs = require('fs');
const path = require('path');

const LOG_MAX_BYTES = 1024 * 1024;

function makeLogger (userDataPath) {
  const LOG_FILE = path.join(userDataPath || process.cwd(), 'axhub-main.log');
  let queue = [];
  let flushing = false;

  function drain () {
    if (flushing || !queue.length) return;
    flushing = true;
    const batch = queue;
    queue = [];
    const text = batch.join('\n') + '\n';
    (async () => {
      try {
        try {
          const st = await fs.promises.stat(LOG_FILE);
          if (st.size > LOG_MAX_BYTES) {
            try { await fs.promises.unlink(LOG_FILE + '.old'); } catch (e) { /* 不存在 */ }
            await fs.promises.rename(LOG_FILE, LOG_FILE + '.old');
          }
        } catch (e) { /* 文件不存在，直接写 */ }
        await fs.promises.appendFile(LOG_FILE, text);
      } catch (e) { /* 写失败不影响运行 */ }
      flushing = false;
      if (queue.length) drain();
    })();
  }

  function log (...args) {
    const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
    queue.push(line);
    console.log(line);
    drain();
  }

  // 同步强制落盘（before-quit 等关键路径调用）
  log.flush = () => {
    if (!queue.length) return;
    const text = queue.join('\n') + '\n';
    queue = [];
    try { fs.appendFileSync(LOG_FILE, text); } catch (e) { /* ignore */ }
  };

  return log;
}

module.exports = { makeLogger };
