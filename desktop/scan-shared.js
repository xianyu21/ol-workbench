'use strict';
/*
 * AxHub 页面扫描 · 共享纯逻辑（单源）
 * --------------------------------------------------------------
 * 服务端（axhub-server.js 扫描导出目录）与浏览器端（File System Access
 * 前端扫描）复用同一份实现。页面 ID 哈希是用户数据（收藏/标签/最近访问）
 * 的关联主键，两端必须逐字节一致 —— 改这里 = 同时改两端，禁止在别处复制。
 *
 * 宿主无关：不 import/require 任何模块，文件遍历与 stat 由各宿主自行胶水。
 * 双格式：Node 走 module.exports；浏览器端由 vite build 以默认导出形式内联。
 */

// AxHub 框架入口文件（不作为业务页面列出）
const FRAME_FILES = new Set([
  'index.html', 'start.html', 'start_c_1.html', 'start_with_pages.html',
  '通用组件.html', 'start_with_pages (1).html'
]);

// 是否框架页：框架白名单 / 任意 start*.html / 通用组件.html；仅 .html/.htm 参与
function isFrameFile (name) {
  if (!/\.html?$/i.test(name)) return false;
  const low = name.toLowerCase();
  if (FRAME_FILES.has(low)) return true;
  if (/^start[^.]*\.html?$/i.test(name)) return true;
  if (low === '通用组件.html') return true;
  return false;
}

// 页面 ID：文件名（含扩展名）djb2 哈希 + 长度后缀。历史数据以此关联，算法不可变。
function computePageId (name) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0;
  return 'p' + h.toString(36) + '_' + name.length.toString(36);
}

// 去扩展名的页面名（如 00-07-01_登录页）
function baseNameOf (name) {
  return String(name).replace(/\.html?$/i, '');
}

// 分组：编号前缀首段（00-07-01_登录页 → 00），无编号归「未分组」
function groupOf (baseName) {
  const seg = String(baseName).split('-');
  return seg.length > 1 ? seg[0] : '未分组';
}

// 固定排序：按文件名 zh 排序
function sortPages (pages) {
  return pages.sort((a, b) => a.path.localeCompare(b.path, 'zh'));
}

const AxHubScan = { FRAME_FILES, isFrameFile, computePageId, baseNameOf, groupOf, sortPages };

if (typeof module !== 'undefined' && module.exports) module.exports = AxHubScan;
if (typeof globalThis !== 'undefined') globalThis.AxHubScan = AxHubScan;
