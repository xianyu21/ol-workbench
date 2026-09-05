'use strict';
/*
 * AxHub 原型工作台 · 用户数据磁盘存储（主进程）
 * --------------------------------------------------------------
 * 收藏/标签/最近访问/标签页布局等核心数据落盘到 userData/wb-user-data.json，
 * localStorage 退化为同源缓存。数据形状 = 渲染层 localStorage 的 wb_axhub_* 快照
 * （key 原样保留，value 为 JSON 反序列化后的对象），主进程不理解内容。
 *
 * 接口（最小）：
 *   init(dir)      指定存储目录（userData 或测试临时目录）
 *   load()         读全部数据；文件缺失返回 null（渲染层据此保留现有 localStorage = 旧数据自动迁移）；
 *                  文件损坏则备份为 .corrupt 后按缺失处理，应用不崩
 *   save(data)     防抖写（渲染层每次变更整包回传，400ms 合并）
 *   flush()        立即落盘（退出前调用）
 *   clear()        清空（备份弹窗"清空全部本地数据"用）
 */
const fs = require('fs');
const path = require('path');

const DEBOUNCE_MS = 400;

let FILE = null;
let writeTimer = null;
let pending = null;

function init (dir) {
  FILE = path.join(dir, 'wb-user-data.json');
}

function load () {
  if (!FILE) return null;
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') {
      // 损坏文件留档排查，按无数据处理（渲染层保留 localStorage 缓存，不丢）
      try { fs.copyFileSync(FILE, FILE + '.corrupt'); } catch (e2) { /* ignore */ }
    }
    return null;
  }
}

function save (data) {
  if (!data || typeof data !== 'object') return;
  pending = data;
  if (writeTimer) return;
  writeTimer = setTimeout(flush, DEBOUNCE_MS);
}

function flush () {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  const data = pending;
  pending = null;
  if (!FILE || !data) return;
  try {
    // 原子写：先写临时文件再改名，进程中途被杀不会留下半个 JSON
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, FILE);
  } catch (e) { /* 写失败不影响运行，下次变更重试 */ }
}

function clear () {
  pending = null;
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  try { fs.unlinkSync(FILE); } catch (e) { /* ignore */ }
}

module.exports = { init, load, save, flush, clear };
