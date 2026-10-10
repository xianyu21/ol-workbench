#!/usr/bin/env node
/*
 * 打包三坑固化（P1-2）：一键可复现的 electron-builder 打包。
 * 铁律#6 三个坑的固化点：
 *   1) 清掉沙箱/CI 注入的环境变量（NODE_OPTIONS / CODEBUDDY_SESSION_ID / CLAUDE_SESSION_ID），
 *      避免 shim 把变量写进产物导致运行期异常。
 *   2) NSIS 缓存检测：缺 StdUtils 宏时清空 %LOCALAPPDATA%/electron-builder/Cache（electron-builder 25 缓存根），触发重新下载。
 *   3) vite 侧已固化 emptyOutDir:false（见 viewer/vite.config.ts），这里只负责清 env + NSIS。
 * 用法：node scripts/dist-safe.mjs [--dry]（--dry 仅做环境校验，不真正打包）。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DRY = process.argv.includes('--dry');

// 1) 清环境变量
process.env.NODE_OPTIONS = '';
delete process.env.CODEBUDDY_SESSION_ID;
delete process.env.CLAUDE_SESSION_ID;

// 2) NSIS 缓存检测（StdUtils::TestParameter 宏存在性）
// electron-builder 25 把下载的二进制缓存放到 %LOCALAPPDATA%/electron-builder/Cache
// （可由 ELECTRON_BUILDER_CACHE 覆盖）；其中 nsis-resources 解压目录为
// Cache/nsis-resources-3.4.1（个别版本在 Cache/nsis/ 下）。该目录缺失 StdUtils 宏时，
// 清空整个 Cache 目录，触发 electron-builder 重新下载正确版本。
function hasStdUtils (dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).some(e => /StdUtils/i.test(e.name));
  } catch (e) { return false; }
}
const cacheRoot = process.env.ELECTRON_BUILDER_CACHE
  || join(process.env.LOCALAPPDATA || homedir(), 'electron-builder', 'Cache');
const nsisResourceCandidates = [
  join(cacheRoot, 'nsis-resources-3.4.1'),
  join(cacheRoot, 'nsis', 'nsis-resources-3.4.1')
];
const badNsis = nsisResourceCandidates.find(d => existsSync(d) && !hasStdUtils(d));
if (badNsis) {
  console.log('[dist-safe] 检测到 NSIS 缓存缺失 StdUtils（' + badNsis + '），清空 Cache 以触发重新下载...');
  if (!DRY) {
    try {
      rmSync(cacheRoot, { recursive: true, force: true });
    } catch (e) {
      console.warn('[dist-safe] 清理 NSIS 缓存失败，请手动删除:', cacheRoot, e && e.message);
    }
  }
}

console.log('[dist-safe] 环境变量已清理；NODE_OPTIONS =', JSON.stringify(process.env.NODE_OPTIONS));

if (DRY) {
  console.log('[dist-safe] --dry 完成：环境校验通过，未执行打包。');
  process.exit(0);
}

// 3) 调用 electron-builder（build:viewer 已在 dist 脚本里先行完成）
const res = spawnSync('npx', ['electron-builder'], { stdio: 'inherit', shell: true });
process.exit(res.status ?? 1);
