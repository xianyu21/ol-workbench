#!/usr/bin/env node
/*
 * 版本号单源脚本（P1-1）：由 `npm version` 钩子触发。
 * npm version 已把 desktop/package.json 更新为新版本，这里把同版本号同步到 viewer
 * （workspaces 下版本单源），并追加一条 CHANGELOG 占位。
 * 铁律#2 不变：仍 bump version，只是把「手改」变为「脚本辅助」。
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..'); // desktop/
const desktopPkgPath = resolve(root, 'package.json');
const viewerPkgPath = resolve(root, 'viewer/package.json');

const desktopPkg = JSON.parse(readFileSync(desktopPkgPath, 'utf8'));
const newVersion = desktopPkg.version;

// 同步 viewer 版本（workspaces 下统一版本号单源）
if (existsSync(viewerPkgPath)) {
  const v = JSON.parse(readFileSync(viewerPkgPath, 'utf8'));
  if (v.version !== newVersion) {
    v.version = newVersion;
    writeFileSync(viewerPkgPath, JSON.stringify(v, null, 2) + '\n');
    console.log('[bump-version] viewer 版本同步为', newVersion);
  }
}

// 追加 CHANGELOG 占位（具体描述由提交信息/implementation.md 提供）
const changelog = resolve(root, 'CHANGELOG.md');
const entry = `\n## ${newVersion} - ${new Date().toISOString().slice(0, 10)}\n- 见 git 提交记录与 .scratch/axhub-refactor/implementation.md\n`;
if (existsSync(changelog)) appendFileSync(changelog, entry);

console.log('[bump-version] 版本已统一为', newVersion);
