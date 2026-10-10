#!/usr/bin/env node
/*
 * 发行校验（P1-1）：校验「三处版本号」一致 ——
 *   desktop.package.json.version === viewer.package.json.version === git 最新 tag（v 前缀）。
 * 由 CI 或发布前手动运行；任一不一致则非零退出。
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const repoRoot = resolve(root, '..');

const desktopPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = desktopPkg.version;
let ok = true;
function fail (msg) { console.error('[release-check] FAIL:', msg); ok = false; }

// 1) desktop 与 viewer 版本应一致
const viewerPkg = JSON.parse(readFileSync(resolve(root, 'viewer/package.json'), 'utf8'));
if (viewerPkg.version !== version) fail(`viewer 版本 ${viewerPkg.version} ≠ desktop 版本 ${version}`);

// 2) git 最新 tag 应等于 v<version>（仓库无 tag 时跳过）
try {
  const tag = execSync('git describe --tags --abbrev=0', { cwd: repoRoot, encoding: 'utf8' }).trim();
  const want = 'v' + version;
  if (tag !== want) fail(`最新 tag ${tag} ≠ 期望 ${want}`);
} catch (e) {
  console.log('[release-check] 仓库无 tag，跳过 tag 校验');
}

if (ok) { console.log('[release-check] OK：三处版本一致 =', version); process.exit(0); }
else process.exit(1);
