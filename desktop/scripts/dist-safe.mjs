#!/usr/bin/env node
/*
 * 打包三坑固化（P1-2）：一键可复现的 electron-builder 打包。
 * 铁律#6 三个坑的固化点：
 *   1) 清掉沙箱/CI 注入的环境变量（NODE_OPTIONS / CODEBUDDY_SESSION_ID / CLAUDE_SESSION_ID），
 *      避免 shim 把变量写进产物导致运行期异常。
 *   2) NSIS 缓存检测：缺 StdUtils 宏时清空 nsis-resources 缓存，触发 electron-builder 重新下载。
 *   3) vite 侧已固化 emptyOutDir:false（见 viewer/vite.config.ts），这里只负责清 env + NSIS。
 * 用法：node scripts/dist-safe.mjs [--dry]（--dry 仅做环境校验，不真正打包）。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DRY = process.argv.includes('--dry');

// 1) 清环境变量
process.env.NODE_OPTIONS = '';
delete process.env.CODEBUDDY_SESSION_ID;
delete process.env.CLAUDE_SESSION_ID;

// 2) NSIS 缓存检测（StdUtils::TestParameter 宏存在性）
function hasStdUtils (dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).some(e => /StdUtils/i.test(e.name));
  } catch (e) { return false; }
}
const nsisCache = join(homedir(), 'AppData/Local/electron-builder/nsis-resources');
if (existsSync(nsisCache) && !hasStdUtils(nsisCache)) {
  console.log('[dist-safe] 检测到 NSIS 缓存缺失 StdUtils，清空缓存以触发重新下载...');
  if (!DRY) {
    const r = spawnSync('rm', ['-rf', nsisCache], { stdio: 'inherit', shell: true });
    if (r.status !== 0) console.warn('[dist-safe] 清理 NSIS 缓存失败，请手动删除:', nsisCache);
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
